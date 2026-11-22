#!/usr/bin/env python
"""
fit_latent.py -- the Python subprocess fitter F2_GDX_SKILL_LATENT_REPRESENTATIONS spawns for
--method autoencoder and --method umap (PCA is fit directly in Node.js via `ml-pca`, no subprocess
needed for it).

Protocol: reads exactly one JSON object from stdin --

  {
    "method": "AUTOENCODER" | "UMAP",
    "matrix": [[float, ...], ...],   // rows = complete-case persons, columns = usable input
                                      // features, in the exact order the caller selected. Already
                                      // z-scored by F1 -- never rescaled again here, same
                                      // "don't double-normalize" rule the PCA path follows.
    "dims": int,                     // k, already validated by the caller against this matrix's
                                      // own shape
    "randomSeed": int,
    "autoencoder": { "maxIter": int } (only present for AUTOENCODER),
    "umap": { "nNeighbors": int|null, "minDist": float } (only present for UMAP; nNeighbors null
                                      means "use this script's own default, capped to the sample
                                      size")
  }

and writes exactly one JSON object to stdout --

  {
    "scores": [[float, ...], ...],   // n_samples x dims, the fitted h(t) for every input row, in
                                      // the same row order as the input matrix
    "reconstructionLoss": float|null,  // AUTOENCODER only; null for UMAP (no such loss exists)
    "methodParams": { ... }           // every hyperparameter actually used, for GDX_HNF_LATENT_RUN
                                      // .METHOD_PARAMS -- nothing silently defaulted without being
                                      // written down
  }

Never reads or writes the database directly, and never reads a file path -- this is a pure numeric
fitter communicating over stdin/stdout, so every GDX_HNF_LATENT_* write stays in exactly one place
(the calling Node.js script). On any error, prints a message to stderr and exits non-zero; the
caller surfaces that message rather than guessing.
"""
import json
import sys

import numpy as np


def fit_autoencoder(X, dims, seed, max_iter):
    """A symmetric encoder/decoder (input -> hidden -> bottleneck(dims) -> hidden -> input),
    trained with an identity reconstruction target (X -> X) via scikit-learn's MLPRegressor.
    MLPRegressor has no public "encode only" method, so after training this replicates its own
    forward pass -- same weights, same activation -- through just the first two layers (input
    -> hidden -> bottleneck) to read out h(t) for every sample. The hidden-layer width is a fixed,
    documented function of the input/bottleneck size (never a silently-chosen magic number): the
    midpoint between the input width and the bottleneck width, floored only by "at least one unit
    wider than the bottleneck."""
    from sklearn.neural_network import MLPRegressor

    n_samples, n_features = X.shape
    hidden = max(dims + 1, round((n_features + dims) / 2))
    hidden_layer_sizes = (hidden, dims, hidden)

    # tanh, not relu: MLPRegressor applies one activation function to every hidden layer,
    # including the bottleneck -- relu's dead-unit failure mode (a unit stuck outputting exactly 0
    # for every sample, confirmed on this project's own test data) is far more damaging at a
    # narrow bottleneck than at a wide hidden layer, and relu also one-sidedly restricts every
    # latent coordinate to be non-negative, unlike a real continuous embedding. tanh is bounded,
    # keeps both signs, and does not collapse the same way, while still being genuinely non-linear
    # (never reducing this to a linear projection PCA already provides).
    activation = "tanh"

    # scikit-learn's early-stopping validation split needs a validation set with at least a
    # handful of rows -- on a small complete-case sample, 10% of n_samples can round down to 0 or
    # 1, which MLPRegressor rejects outright. Early stopping is a (documented) convenience against
    # overfitting, not part of the reconstruction formula itself, so it is simply skipped below
    # this sample-size floor rather than crashing the whole fit.
    validation_fraction = 0.1
    early_stopping = round(n_samples * validation_fraction) >= 2

    model = MLPRegressor(
        hidden_layer_sizes=hidden_layer_sizes,
        activation=activation,
        solver="adam",
        max_iter=max_iter,
        random_state=seed,
        early_stopping=early_stopping,
        validation_fraction=validation_fraction,
        n_iter_no_change=20,
    )
    model.fit(X, X)

    def tanh(a):
        return np.tanh(a)

    # Forward-propagate through layer 0 (input->hidden) and layer 1 (hidden->bottleneck) only --
    # the SAME two weight matrices/biases the trained model itself uses for these layers.
    h = X
    for i in range(2):
        h = tanh(h @ model.coefs_[i] + model.intercepts_[i])

    reconstruction = model.predict(X)
    reconstruction_loss = float(np.mean(np.sum((X - reconstruction) ** 2, axis=1)))

    return h, reconstruction_loss, {
        "library": "scikit-learn",
        "estimator": "MLPRegressor",
        "architecture": f"{n_features}-{hidden}-{dims}-{hidden}-{n_features}",
        "hiddenWidthRule": "round((n_features + dims) / 2), floored at dims + 1",
        "activation": activation,
        "solver": "adam",
        "maxIter": max_iter,
        "earlyStopping": early_stopping,
        "validationFraction": validation_fraction,
        "nIterNoChange": 20,
        "randomSeed": seed,
        "actualIterations": int(model.n_iter_),
    }


def fit_umap(X, dims, seed, n_neighbors_requested, min_dist):
    """Real UMAP via the umap-learn package -- never approximated with t-SNE/PCA/anything else
    under the UMAP label. n_neighbors must be < n_samples; when the caller didn't pin a value, this
    uses umap-learn's own documented default (15), capped down to fit this run's own sample size."""
    import umap

    n_samples = X.shape[0]
    n_neighbors = n_neighbors_requested if n_neighbors_requested else 15
    n_neighbors = max(2, min(n_neighbors, n_samples - 1))

    reducer = umap.UMAP(
        n_components=dims,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        metric="euclidean",
        random_state=seed,
    )
    scores = reducer.fit_transform(X)

    return scores, None, {
        "library": "umap-learn",
        "nNeighbors": n_neighbors,
        "minDist": min_dist,
        "metric": "euclidean",
        "randomSeed": seed,
    }


def main():
    payload = json.load(sys.stdin)
    method = payload["method"]
    X = np.array(payload["matrix"], dtype=float)
    dims = int(payload["dims"])
    seed = int(payload.get("randomSeed", 42))

    if method == "AUTOENCODER":
        max_iter = int(payload.get("autoencoder", {}).get("maxIter", 2000))
        scores, loss, params = fit_autoencoder(X, dims, seed, max_iter)
    elif method == "UMAP":
        umap_opts = payload.get("umap", {})
        scores, loss, params = fit_umap(X, dims, seed, umap_opts.get("nNeighbors"), float(umap_opts.get("minDist", 0.1)))
    else:
        raise ValueError(f"Unsupported method: {method!r} -- this script only fits AUTOENCODER or UMAP (PCA is fit in Node.js).")

    scores_list = scores.tolist() if hasattr(scores, "tolist") else scores
    if len(scores_list) != X.shape[0] or any(len(row) != dims for row in scores_list):
        raise RuntimeError(f"Internal error: fitted scores have the wrong shape (expected {X.shape[0]}x{dims}).")

    json.dump({"scores": scores_list, "reconstructionLoss": loss, "methodParams": params}, sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # surfaced verbatim to the Node.js caller's stderr capture
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
