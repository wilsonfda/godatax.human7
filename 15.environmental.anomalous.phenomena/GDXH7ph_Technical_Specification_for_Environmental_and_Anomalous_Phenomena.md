# GDX H7ph — Technical Specification for Sensor Integration
## Environmental & Anomalous Phenomena (EAP)

| | |
|---|---|
| **Module** | `15.environmental.anomalous.phenomena` |
| **Version** | 1.0 |
| **Date** | 2026-10-21 |
| **Status** | Technical specification — the physical/capture infrastructure is not yet implemented. The relational database has already been created/modeled in the script `C:\Wilson\GoDataX\GDX_HUMAN7\15.environmental.anomalous.phenomena\environmental_anomalous_phenomena_model_firebird25.sql` (same folder as this document) and is already applied to the project's Firebird database. |
| **Sources** | `GoDataXHuman7-Br3.ppt`, slides 105–114 (chapter "GoDataXh7 PH, the Environmental Bias and Anomalous Phenomena"); `Beyond_the_Labyrinth_Livro_Final.pdf`, pages 185–201 (appendix "GoDataXh7 PH, the Environmental Bias and Anomalous Phenomena") |

> **Methodological note inherited from the source:** this document specifies an
> **instrumental observation** layer, not an **interpretation** layer. Sensors measure
> physical quantities; presence, entity, communication, or metaphysical causality are
> hypotheses of the analytical layer, never an automatic conclusion of the capture
> layer specified here. This separation is, in itself, an architectural requirement
> (see §10) and runs through every section below.

---

## Summary

1. [Introduction and objective](#1-introduction-and-objective)
2. [Methodological principles](#2-methodological-principles)
3. [The 21 observation dimensions](#3-the-21-observation-dimensions)
4. [Physical sensor integration architecture](#4-physical-sensor-integration-architecture)
5. [Technical specification per sensor](#5-technical-specification-per-sensor)
6. [Time synchronization](#6-time-synchronization)
7. [Spatial observation model](#7-spatial-observation-model)
8. [Electrical power, grounding and EMI shielding](#8-electrical-power-grounding-and-emi-shielding)
9. [Big Data layer — capture and ingestion](#9-big-data-layer--capture-and-ingestion)
10. [Observation/interpretation separation — methodological governance](#10-observationinterpretation-separation--methodological-governance)
11. [Data treatment and engineering](#11-data-treatment-and-engineering)
12. [Structured persistence — database model](#12-structured-persistence--database-model)
13. [Integration with the other GoDataX Human 7 layers](#13-integration-with-the-other-godatax-human-7-layers)
14. [Non-functional requirements](#14-non-functional-requirements)
15. [Implementation roadmap](#15-implementation-roadmap)
16. [References](#16-references)

---

## 1. Introduction and objective

GoDataX Human 7 was designed to investigate the human experience from multiple
perspectives — psychometric, neurophysiological (cardiac coherence/HRV), and
philosophical-metaphysical (Septenary Constitution, Thomas Aquinas's Five Ways,
Virtology). The **Environmental & Anomalous Phenomena (EAP)** bias extends this
observation beyond the individual, incorporating the **physical space** that
surrounds them: its variations in temperature, luminosity, pressure, vibration,
electric and magnetic fields, acoustic frequencies, electromagnetic radiation, and
other physical manifestations measurable by instruments.

The proposal establishes two complementary directions of observation:

1. **The individual as seen from the environment** — the physical signals that a
   person's presence and activity produce in the surrounding space (body heat,
   sound, movement, mechanical vibration, change in local conditions).
2. **The environment on its own** — physical phenomena observed independently of
   human presence, serving as a baseline to distinguish what is the effect of a
   person from what is an autonomous environmental variation.

This document specifies **how** that observation is technically carried out: the
physical sensors recommended per dimension, how they connect to an acquisition
gateway (Raspberry Pi 5) and to a heavy-processing station (Mini PC), how the data
flows into a Big Data layer, and how that layer ultimately delivers structured,
traceable records to the relational model already applied to the database
(`GDX_PH_*`, see §12).

**Out of scope for this document**: the analytical/interpretive layer itself
(Machine Learning models for pattern detection, hypotheses about metaphysical
causes) — this specification covers only the physical and data-engineering chain
that **feeds** that layer, never replaces it.

---

## 2. Methodological principles

These principles, drawn directly from the book's appendix (p. 185–201), are
architectural requirements, not merely editorial guidance:

1. **Observe first. Then measure, record, correlate, and validate. Only then
   interpret.** The entire technical chain (sensor → gateway → Big Data → database)
   must preserve this order — no capture or treatment stage may issue an
   interpretive conclusion.
2. **Preservation of raw data (Raw Data).** Every original measurement must be
   preserved in full, even after filtering, normalization, or transformation — never
   overwritten by its processed version.
3. **Full traceability.** Every analytical conclusion must be traceable back to the
   sensor, the raw record, and the procedure that produced it (sensor identifier,
   equipment type, measured quantity, value, unit, sampling frequency, acquisition
   time, location, experimental session, processing version, calibration
   conditions).
4. **Multi-sensor time synchronization.** Sensors have very different sampling
   frequencies, precision, and temporal resolution; the architecture must know, for
   every measurement, not just the value but the exact instant, the duration, the
   acquisition interval, and the associated temporal uncertainty margin (see §6).
5. **Space-time matrix.** Every measurement must be locatable in space (which
   sensor, at which position, with what coverage) and in time (which observation
   window), allowing precise statements of **what** was observed, **by which**
   instruments, **in which** physical volume, **at what** moment, and **under
   which** conditions (see §7).
6. **Hard separation between measurement and interpretation.** Stating that multiple
   signals occurred within the same space-time window is a technical fact;
   attributing to that coincidence a meaning of presence, communication, or
   metaphysical causality is a hypothesis, and must remain identified as such, never
   mixed into the physical record (see §10).

---

## 3. The 21 observation dimensions

The EAP roadmap is structured into **21 dimensions**, distributed across **5
categories** (source: book p. 186–187 and slides 107–108). 20 dimensions are
physical observation modalities; the 21st (Temporal) is dedicated to the
control/synchronization that makes all the others viable.

### 3.1 Electrical, Magnetic & Electromagnetic

| # | Dimension | Equipment/sensor (example) | What it objectively measures | Experimental application |
|---|---|---|---|---|
| 1 | Ambient electric field | E-field meter / electrometer | Electric field variations | Unusual electrical changes |
| 2 | Ambient magnetic field | Fluxgate / OPM magnetometer | Magnetic intensity and variations | Local magnetic anomalies |
| 3 | Geomagnetic | Triaxial magnetometer | Earth's X/Y/Z field | Separating a local phenomenon from a global geomagnetic variation |
| 4 | RF / Electromagnetic | SDR / spectrum analyzer | Frequency, power, modulation | Transmissions and interference |
| 5 | VLF / ULF | VLF/ULF receiver | Very low frequencies | Low-frequency phenomena |

### 3.2 Acoustic & Vibration

| # | Dimension | Equipment/sensor (example) | What it objectively measures | Experimental application |
|---|---|---|---|---|
| 6 | Acoustic (audible) | Measurement microphone | Audible sound | Voices, noises, and acoustic events |
| 7 | Infrasound | Infrasound microphone/sensor | Frequencies < 20 Hz | Inaudible vibrations |
| 8 | Ultrasound | Ultrasonic microphone | Frequencies > 20 kHz | Acoustic events beyond human hearing |
| 9 | Vibration | Accelerometer / geophone | Mechanical movement | Footsteps, impacts, structural vibration |

### 3.3 Optical, Thermal & Photonic

| # | Dimension | Equipment/sensor (example) | What it objectively measures | Experimental application |
|---|---|---|---|---|
| 10 | Thermal | Radiometric FLIR camera (A50/A70 or Lepton) | Temperature and thermal distribution | Unusual hot/cold regions |
| 11 | Infrared (optical) | IR/NIR camera | Infrared radiation | Phenomena invisible to the human eye |
| 12 | Visible (low light) | Low-light camera | Light and movement | Synchronized visual recording |
| 13 | Ultraviolet | UV camera/detector | UV radiation | Luminous events outside the visible spectrum |
| 14 | Photonic | PMT / EMCCD | Photon counting (UPE) | Extremely low-intensity luminous events |

### 3.4 Environmental & Physico-Chemical

| # | Dimension | Equipment/sensor (example) | What it objectively measures | Experimental application |
|---|---|---|---|---|
| 15 | Ionizing radiation | Geiger counter / dosimeter | Alpha, beta, gamma | Monitoring radiation variations |
| 16 | Electrostatic | Electrostatic field meter | Electrostatic field/charge | Changes in ambient charge |
| 17 | Air ionization | Ion counter | Positive/negative ions | Physico-chemical environmental changes |
| 18 | Atmospheric | Temp./humidity/pressure station | Ambient conditions | Ruling out meteorological explanations |
| 19 | CO₂ / VOC / gases | Ambient gas sensors | Air composition | Identifying environmental causes |
| 20 | Luminosity | Lux meter | Light intensity | Detecting lighting changes |

### 3.5 Integration & Control

| # | Dimension | Equipment/sensor (example) | What it objectively measures | Experimental application |
|---|---|---|---|---|
| 21 | Temporal | GPS Clock / NTP / PTP | Precise time | Synchronizing all sensors |

> Source: Book, p. 199–201 (full "Environmental, Energetic & Anomalous
> Phenomena Measurement" table) and slides 107–108 ("Consolidation of dimensions,
> sensors, and experimental applications").

---

## 4. Physical sensor integration architecture

Acquisition is distributed between **two edge components** — following the
reference technical design (slide 110, "Sensor Integration Architecture: Raspberry
Pi 5 + Mini PC with interconnected sensors") — and can scale, by design, to **one
dedicated Raspberry Pi per sensor or group of sensors**, whenever volume or
environmental sensitivity requires it.

```
                                    ┌────────────────────────────────────────────┐
  Low-demand sensors                │        RASPBERRY PI 5                      │
  (I2C/SPI/UART) ---->              │        Acquisition Gateway                 │
                                    │  Collection, pre-processing and            │
                                    │  time synchronization                      │
                                    └───────────────┬────────────────────────────┘
                                                    │ Ethernet (dedicated link)
                                                    ▼
                                    ┌────────────────────────────────────────────┐
  High-demand sensors               │        MINI PC                             │
  (USB/Ethernet) ---->              │        Heavy Processing /                  │
                                    │        Scientific Instruments              │
                                    │  Advanced processing, AI,                  │
                                    │  analysis and visualization                │
                                    └───────────────┬────────────────────────────┘
                                                    │ Ethernet (network uplink)
                                                    ▼
                                    ┌────────────────────────────────────────────┐
                                    │   BIG DATA LAYER (§9)                      │
                                    └────────────────────────────────────────────┘
```

### 4.1 Raspberry Pi 5 — Acquisition Gateway

Responsible for the "light" environmental sensors: luminosity, movement/vibration,
audio, electric/electrostatic fields, magnetic field, ionizing radiation, air
ionization — connected via **I²C**, **SPI**, and **UART**.

| Specification | Value |
|---|---|
| SoC | Broadcom BCM2712, quad-core Arm Cortex-A76 @ 2.4 GHz |
| RAM | 8 GB LPDDR4X (minimum recommended for local buffer + capture agent) |
| Storage | microSD (boot) + NVMe SSD via PCIe 2.0 ×1 HAT (high-write-rate local buffer) |
| GPIO | 40-pin header, 3.3V logic — I²C, SPI, UART, PWM buses |
| Connectivity | Gigabit Ethernet (dedicated link to the Mini PC), Wi-Fi 5 (backup/management), Bluetooth 5.0 |
| USB | 2× USB 3.0 + 2× USB 2.0 (light USB sensors, alternative USB GPS) |
| Power | 5V/5A (27W) via USB-C PD; a UPS module (e.g. PiJuice or UPS HAT) is recommended for graceful shutdown on power loss |
| Clock | On-board RTC with coin-cell battery (keeps the time base during power outages, complementary to GPS/NTP — see §6) |
| Cooling | Official Active Cooler (continuous 24×7 operation in an enclosed environment) |
| Thermal operating range | 0–50 °C (indoor environment); for outdoor installation, a passively climatized enclosure is required (§8) |
| Operating system | Raspberry Pi OS (64-bit, Debian-based) or Ubuntu Server 24.04 LTS (arm64) |
| Role in the pipeline | Collection via I²C/SPI/UART, GPS/NTP-disciplined timestamping, local buffer (ring buffer + SQLite), MQTT publishing to the Big Data layer |

### 4.2 Mini PC — Heavy Processing / Scientific Instruments

Responsible for the sensors that require greater computational capacity: spectrum
analyzers/SDR, thermal cameras, photonic equipment, and, optionally, the
neurophysiological devices from the framework's other perspectives (e.g. a cardiac
coherence chest strap) — connected via **USB 3.x** and **Ethernet**.

| Specification | Recommended value |
|---|---|
| CPU | x86-64, minimum Intel Core i5 (12th gen+) or equivalent AMD Ryzen 5 — real-time SDR demodulation and thermal/photonic image processing require multiple cores |
| RAM | 32 GB DDR4/DDR5 (RF spectrum buffers, thermal frames, and video streams are memory-intensive) |
| Storage | 1 TB+ NVMe SSD (high-rate raw RF/video/audio data before offloading to the Big Data layer) |
| GPU | Integrated (Intel Iris Xe) as a minimum floor; a discrete GPU is recommended if embedded ML inference (pattern detection in spectrograms/thermograms) is anticipated |
| Connectivity | 2.5GbE Ethernet (network uplink), dedicated Gigabit Ethernet link to the Raspberry Pi 5, USB 3.2 Gen 2 (≥ 4 ports) |
| Power | 90W+ internal power supply with an external UPS sized for graceful shutdown |
| Operating system | Ubuntu Server 24.04 LTS (x86-64) — native compatibility with SDR drivers (librtlsdr, HackRF libhackrf) and thermal camera SDKs (FLIR Spinnaker/PureThermal) |
| Role in the pipeline | High-rate capture/demodulation, pre-processing (spectrum FFT, thermogram radiometric calibration, photonic binning), publishing to the Big Data layer |

### 4.3 Sensor → interface → controller mapping

| Sensor category | Physical interface | Controller | Technical note |
|---|---|---|---|
| Environmental sensors (temp./humid./pressure/CO₂/VOC) | I²C | Raspberry Pi 5 | Shared bus — see address table §5.4 |
| Luminosity (lux meter) | I²C | Raspberry Pi 5 | Fixed factory address, shares the bus |
| Vibration/movement (accelerometer/geophone) | I²C (accelerometer) / SPI+ADC (analog geophone) | Raspberry Pi 5 | The geophone is an analog signal — requires an external ADC (MCP3008, SPI, 8 channels, 10 bits), since the Pi 5 has no native analog input |
| Audio (audible/infrasound/ultrasound) | I²S (digital MEMS microphones) or USB (dedicated audio interface) | Raspberry Pi 5 | Infrasound and ultrasound require specific microphones/transducers outside the range of a standard voice microphone |
| Electric/electrostatic field | UART or analog output + SPI ADC | Raspberry Pi 5 | Bench equipment (E-field meter) typically exposes a serial or analog output |
| Magnetic / geomagnetic field | I²C | Raspberry Pi 5 | Fluxgate/OPM magnetometer — **sensitive to the Pi's own EMI**, requires a minimum physical distance (see §8) |
| Ionizing radiation (Geiger) | UART (converted pulse) or GPIO (pulse count) | Raspberry Pi 5 | Geiger counters typically emit one TTL pulse per event — counted via a GPIO interrupt |
| Air ionization | UART/Serial-USB | Raspberry Pi 5 | Bench ion counters typically only expose a serial output |
| RF / SDR / VLF-ULF | USB 3.0 | Mini PC | High sampling rate (HackRF One: up to 20 MS/s) requires x86 processing |
| Thermal (FLIR) | USB (radiometric cameras) or SPI+I²C (embedded modules such as Lepton+PureThermal) | Mini PC (USB) / Raspberry Pi 5 (embedded module) | Depends on the model — bench camera vs. OEM module |
| Infrared/Visible/UV (cameras) | USB 3.0 | Mini PC | Continuous video streaming requires USB 3.0+ |
| Photonic (PMT/EMCCD) | USB or manufacturer-specific interface (e.g. Thorlabs) | Mini PC | Requires the manufacturer's proprietary software running on the Mini PC |
| GPS/temporal | UART (NMEA) + GPIO (PPS pulse) | Raspberry Pi 5 (time master) | See §6 |
| Optional human sensors (ECG/HRV, respiration) | Bluetooth LE / ANT+ | Mini PC or Raspberry Pi 5 | Integration with `6.cardiac.coherence` — see §13 |

### 4.4 Alternative design: one Raspberry Pi per sensor

The reference design does not rule out — and this specification adopts as a valid
scaling option — **one dedicated Raspberry Pi per sensor** (or per small group of
sensors in the same category), instead of concentrating everything in a single
gateway. This variant is recommended when:

- The volume of a single modality (e.g. multi-channel audio, continuous thermal
  video) saturates the bus or CPU of a shared gateway;
- The EMI shielding of a sensitive sensor (magnetometer, E-field meter) requires
  total physical isolation from any other nearby digital electronics;
- The scale of the experiment (multiple simultaneous rooms/locations) requires
  independent replicas of the same capture architecture.

In this model, each Raspberry Pi publishes to the same Big Data layer (§9),
identified by its own `ID_SENSOR`/`ID_LOCATION` (see §12), preserving the same
observation space-time matrix.

---

## 5. Technical specification per sensor

This section details, per dimension, the recommended electrical and interface
profile. The models cited are reference examples (consistent with the design in
slide 110 and with the "Ghost Hunting Kit / Spirit Box / MEL & K2 EMF Meter"
equipment cited in slide 114 as an entry-level floor); any equivalent, calibratable
sensor with a public datasheet is acceptable, as long as it meets the indicated
minimum range/resolution.

### 5.1 Electrical, Magnetic & Electromagnetic

| # | Sensor (example) | Interface | Voltage | Range | Resolution/Sensitivity | Sampling rate |
|---|---|---|---|---|---|---|
| 1 | E-field meter (e.g. Trifield TF2, or a bench electrometer module) | UART/analog+ADC | 5V (sensor power) / 3.3V logic | 0–1000 V/m (typical) | ~1 V/m | 1–10 Hz |
| 2 | Fluxgate magnetometer or biomagnetic OPM | I²C / UART (OPM) | 3.3V–5V | ±100 µT to ±800 µT (fluxgate) / fT (OPM) | nT (fluxgate) / fT (OPM) | 10–1000 Hz |
| 3 | Triaxial magnetometer (e.g. QMC5883L / LIS3MDL) | I²C (address 0x0D / 0x1E) | 3.3V | ±800 µT | 0.1–0.2 µT | up to 200 Hz |
| 4 | SDR / spectrum analyzer (e.g. HackRF One, RTL-SDR) | USB 3.0 | 5V (bus-powered) | 1 MHz – 6 GHz (HackRF) | depends on the ADC (8 bits, HackRF) | up to 20 MS/s |
| 5 | Dedicated VLF/ULF receiver | UART/USB | 5V | 0.1 Hz – 20 kHz (VLF) | depends on the receiver | 1–48 kHz |

### 5.2 Acoustic & Vibration

| # | Sensor (example) | Interface | Voltage | Range | Resolution | Sampling rate |
|---|---|---|---|---|---|---|
| 6 | Measurement microphone / digital MEMS (e.g. INMP441, I²S) | I²S | 3.3V | 20 Hz – 20 kHz | 24 bits | 48 kHz |
| 7 | Dedicated infrasound microphone/sensor | Analog+ADC or USB | 3.3V–5V | < 20 Hz (typically 0.1–20 Hz) | depends on the ADC (16–24 bits recommended) | ≥ 200 Hz |
| 8 | Ultrasonic microphone (e.g. 40 kHz+ capacitive transducer) | Analog+ADC or USB | 5V | 20 kHz – 100 kHz+ | depends on the ADC | ≥ 250 kHz |
| 9 | Accelerometer (e.g. ADXL345/MPU6050) / Geophone | I²C (accelerometer) / Analog+ADC SPI (geophone) | 3.3V | ±16 g (accelerometer) / mm/s (geophone) | 13 bits (ADXL345) | up to 3200 Hz |

### 5.3 Optical, Thermal & Photonic

| # | Sensor (example) | Interface | Voltage | Range | Resolution | Sampling/frame rate |
|---|---|---|---|---|---|---|
| 10 | Radiometric FLIR camera (A50/A70 or Lepton 3.5 module) | USB (A50/A70) or SPI+I²C (Lepton+PureThermal) | 5V (Lepton) / PoE (A-series) | -20 °C to 550 °C (radiometric) | 0.05 °C (typical NETD) | 9–30 Hz (Lepton 8.7 Hz) |
| 11 | IR/NIR camera | USB 3.0 | 5V | 700 nm – 1100 nm (NIR) | depends on the CMOS sensor | 30–60 fps |
| 12 | Low-light camera | USB 3.0 | 5V | 0.001–0.1 lux (minimum) | depends on the sensor | 30–60 fps |
| 13 | UV camera/detector | USB 3.0 | 5V | 10 nm – 400 nm | depends on the sensor | 30 fps |
| 14 | PMT / EMCCD (e.g. Thorlabs photon counter module) | USB/manufacturer-specific interface | 12V–24V (internal PMT high voltage) | single-photon counting | discrete count (cps) | up to MHz count rate |

### 5.4 Environmental & Physico-Chemical

| # | Sensor (example) | Interface | Voltage | Range | Resolution | I²C address (where applicable) |
|---|---|---|---|---|---|---|
| 15 | Geiger counter (SBM-20-type tube or ready-made module) | GPIO (TTL pulse) or UART | 5V (tube power, typically via an internal high-voltage converter) | 0–1000 µSv/h (typical for environmental use) | 1 pulse/event | — |
| 16 | Electrostatic field meter | UART/analog+ADC | 5V | ±20 kV (typical) | ~0.1 kV | — |
| 17 | Ion counter | UART/Serial-USB | 5V–12V | 0–20,000 ions/cm³ | depends on the equipment | — |
| 18 | BME280 (temp./humidity/pressure) | I²C | 3.3V | -40–85 °C / 0–100% RH / 300–1100 hPa | 0.01 °C / 0.008% / 0.18 hPa | 0x76 or 0x77 |
| 19 | CO₂ (e.g. MH-Z19 NDIR or SCD30) / VOC (e.g. CCS811/SGP30) | UART (MH-Z19) or I²C (SCD30/CCS811) | 5V (MH-Z19) / 3.3V (I²C) | 400–5000 ppm (CO₂) | 1 ppm (SCD30) | 0x61 (SCD30) / 0x5A (CCS811) |
| 20 | BH1750 (lux meter) | I²C | 3.3V–5V | 1–65,535 lux | 1 lux | 0x23 or 0x5C |

### 5.5 Integration & Control

| # | Sensor (example) | Interface | Voltage | Precision | Note |
|---|---|---|---|---|---|
| 21 | GPS module (e.g. NEO-M8N) + NTP/PTP | UART (NMEA) + GPIO (PPS signal) | 3.3V–5V | PPS: ±50 ns (GPS-disciplined) / NTP: ±1–10 ms (local network) / PTP: ±1 µs (network with hardware timestamping) | See §6 for the full synchronization architecture |

> **Note on conflicting I²C addresses:** when two sensors on the same bus share
> the same factory address (e.g. two BME280 modules at different locations), use
> an I²C multiplexer (e.g. TCA9548A) or move one of the sensors to a secondary
> I²C bus available via GPIO.

### 5.6 Optional human sensors (cross integration)

For the correlation anticipated in the chapter (heart rate × environmental
signals), the Mini PC can also receive, via Bluetooth LE, the devices already
standardized in `6.cardiac.coherence`:

| Device (example) | Interface | Quantity |
|---|---|---|
| Movesense ECG/HRV | Bluetooth LE | ECG, RR intervals, heart rate |
| Respiration belt (e.g. Vernier Respiration Belt) | Bluetooth LE / analog+ADC | Respiratory rate |

---

## 6. Time synchronization

Dimension 21 (Temporal) is not "just another sensor" — it is the infrastructure
that makes the data from all the others comparable. Without it, the statement "five
sensors recorded something within the same window" cannot be verified.

### 6.1 Three-layer architecture

| Layer | Technology | Typical precision | When to use |
|---|---|---|---|
| Primary source | **GPS Clock** (GPS module with PPS output — pulse per second) | ±50 ns relative to UTC | Master absolute-time reference for the whole installation |
| Local-network distribution | **NTP** (Network Time Protocol), local NTP server disciplined by GPS (e.g. `chrony` or `ntpd` on the Raspberry Pi 5 acting as stratum 1) | ±1–10 ms between nodes on the local network | Standard synchronization between the Raspberry Pi 5, the Mini PC, and other network nodes |
| High-precision distribution | **PTP** (Precision Time Protocol, IEEE 1588) | ±1 µs (with a NIC/switch supporting hardware timestamping) | Needed only when the comparison window between sensors must be milliseconds or less (e.g. fine correlation between audio and magnetic field) |

### 6.2 Reference implementation

1. The **Raspberry Pi 5** receives the GPS module via UART (NMEA signal) and the
   **PPS** pulse via GPIO — this Pi acts as the installation's **stratum 1 NTP
   server** (`chrony` disciplined by PPS + NMEA).
2. The **Mini PC** and any additional Raspberry Pi (§4.4 model) synchronize against
   that local server via NTP.
3. When the application requires sub-millisecond comparison windows, a dedicated
   PTP network (an IEEE 1588-capable switch) replaces NTP between the critical
   nodes.
4. The **Raspberry Pi 5's on-board RTC** (coin-cell battery) preserves the time
   base during power outages, avoiding a "cold start" with no time reference until
   the GPS reacquires a signal.

### 6.3 Recording temporal uncertainty

Every recorded measurement (see §12, `GDX_PH_OBSERVATION`/`GDX_PH_EVENT`) must, at
minimum implicitly through the infrastructure, be traceable to the time source that
produced it (GPS-PPS, NTP, or PTP) — sensors whose own sampling rate is already
slower than the time source's precision (e.g. a weather station with 1 reading per
minute) do not benefit from PPS, and their uncertainty margin is, in practice, the
sensor's own sampling rate. **Multi-sensor comparison windows (see the book's
example: 5 sensors within 1 ms) can only be asserted for sensors whose precision
and temporal resolution actually support that window** — for the others, the
comparison window must be widened, never the uncertainty omitted.

---

## 7. Spatial observation model

1. **Delimited experimental environment**: each session defines a physical volume
   (room, investigation area) with known dimensions, within which the sensors are
   distributed in a planned manner.
2. **Identification and positioning per sensor**: each piece of equipment records
   its location, orientation, distance relative to the other instruments, and
   estimated coverage area/volume (see `GDX_PH_LOCATION`/`GDX_PH_SENSOR` in §12).
3. **Coverage vs. total volume**: a point sensor (e.g. a magnetometer) measures at a
   specific point; a camera observes a surface or a three-dimensional region.
   Stating that multiple signals occurred "in the same cubic meter" depends on the
   spatial resolution, positioning, and demonstrable coverage of each instrument —
   never assumed.
4. **Space-time matrix**: combining §6 (time) with this spatial model allows
   relating location, acquisition instant, and recorded physical phenomenon — the
   data structure that underpins this matrix is the pairing
   `GDX_PH_LOCATION` × `GDX_PH_SESSION` × `GDX_PH_EVENT` (§12).

---

## 8. Electrical power, grounding and EMI shielding

The physical integration of high-switching-frequency digital sensors (Pi, Mini PC,
power supplies) alongside sensors that are extremely sensitive to electric/magnetic
fields (dimensions 1–5) creates a real risk of **the experiment contaminating
itself** — the capture system measuring its own noise.

### 8.1 Physical installation recommendations

| Concern | Recommended mitigation |
|---|---|
| Switching noise from the Pi/Mini PC power supplies affecting the magnetometer/E-field meter | Recommended minimum physical distance ≥ 1–2 m between the digital electronics (Pi/Mini PC) and the electric/magnetic field sensors; shielded, twisted cables on the analog sensors |
| Ground loop between multiple pieces of equipment | A single grounding point (star grounding) for the whole installation; never ground the same sensor at two different points |
| RF interference from the Pi's own Wi-Fi/Bluetooth affecting the SDR/VLF receiver | Disable unused radios on boards near the SDR; use an Ethernet cable (not Wi-Fi) as the main link between the Pi and the Mini PC |
| Noise on long analog sensor cables (geophone, E-field) | Shielded cable with the shield grounded at a single point; ferrite chokes at the cable ends |
| Mechanical vibration from the fans/coolers themselves affecting the accelerometer/geophone | Mechanical isolation (rubber dampers) between the Pi/Mini PC chassis and the surface where the accelerometer/geophone is mounted |

### 8.2 Power sizing

| Component | Typical consumption | Note |
|---|---|---|
| Raspberry Pi 5 + light I²C/SPI/UART sensors | ~15–27 W | Dedicated 27W USB-C PD supply |
| Mini PC + USB peripherals (SDR, cameras) | ~65–90 W | Its own internal power supply |
| Bench modules (E-field meter, ion counter, Geiger) | Variable, typically their own batteries or a dedicated 5–12V supply | Check each piece of equipment's datasheet |
| UPS/battery backup | Sized for a minimum 15-minute autonomy (graceful shutdown) | Essential to avoid corrupting the time-synchronization window (§6) in the event of a power outage |

### 8.3 Enclosure and operating environment

- **Indoor installation**: standard ventilated enclosure, with no requirement for
  weather protection.
- **Outdoor installation**: enclosure with a minimum **IP65** rating, passive
  climate control (filtered ventilation, sun protection), and special attention to
  sensors that require direct exposure to the environment (e.g. weather station,
  electric field) vs. those that require full protection (Pi, Mini PC).

---

## 9. Big Data layer — capture and ingestion

> Source: Book, p. 191–192 — "the expansion of GoDataX Human 7ph proposes the
> adoption of a Big Data architecture, designed to process large volumes of
> information from multiple sources, with different speeds and formats (...) is a
> planned architectural evolution, and its implementation may involve distributed
> processing technologies, time-series storage, and continuous event processing,
> according to the volume, speed, and availability requirements identified during
> testing."

This section proposes the concrete technical architecture for that layer, keeping
it decoupled from the relational database `GDX_PH_*` (which remains the
**structured, traceable persistence** layer, not a high-volume capture layer — see
§12).

### 9.1 Pipeline overview

```
 EDGE (Pi 5 / Mini PC)
   │  publishes via MQTT (one topic per sensor/dimension)
   ▼
 MESSAGE BROKER (Mosquitto, with bridge to the central tier)
   │
   ├──► NUMERIC TIME-SERIES INGESTION  ──► TimescaleDB / InfluxDB  (hot storage, short-term queries)
   │
   ├──► RAW MEDIA INGESTION (audio, video, thermogram, RF I/Q) ──► S3-compatible Object Storage (MinIO)  (raw storage, "Raw Data" preserved)
   │
   └──► CONTINUOUS EVENT PROCESSING (stream processing)
           │  temporal correlation windows (§6), threshold/anomaly detection
           ▼
        VALIDATION/NORMALIZATION ETL (§11)
           │
           ▼
        STRUCTURED PERSISTENCE — GDX_PH_* (Firebird, §12)
           │
           ▼
        ANALYTICAL LAYERS (Data Warehouse / Neo4j Knowledge Graph — §13)
```

### 9.2 Recommended components

| Layer | Recommended technology | Role |
|---|---|---|
| Edge → broker transport | **MQTT** (e.g. Eclipse Mosquitto) | Lightweight protocol, tolerant of intermittent connections, well suited to the Raspberry Pi 5 and to low-rate sensors; one topic per sensor/dimension (e.g. `gdxh7ph/<location>/<sensor_id>/<dimension>`) |
| Local edge buffer | SQLite (ring buffer) on the Raspberry Pi 5 | Ensures no reading is lost in the event of a momentary network outage between the Pi and the broker |
| Continuous event processing | Lightweight stream-processing engine (e.g. Node-RED for simple correlation; Kafka Streams/Flink if volume justifies it) | Applies temporal correlation windows (§6) and flags `GDX_PH_EVENT` candidates in real time |
| Time-series storage (hot) | **TimescaleDB** (PostgreSQL extension) or **InfluxDB** | Efficient high-frequency querying (electric field, magnetic field, vibration, audio amplitude) over the short/medium term |
| Raw media storage (raw) | **S3-compatible object storage** (e.g. self-hosted MinIO) | Audio, video, thermograms, RF I/Q captures — large, binary, never overwritten (Raw Data, principle §2) |
| Batch orchestration/ETL | Scheduled Python jobs (e.g. `cron` + scripts, or Apache Airflow if scale justifies it) | Validation, normalization, temporal alignment, and final load into Firebird `GDX_PH_*` (§11) |

### 9.3 Why not write directly to Firebird from the sensors

The `GDX_PH_*` database, already created by the script
`C:\Wilson\GoDataX\GDX_HUMAN7\15.environmental.anomalous.phenomena\environmental_anomalous_phenomena_model_firebird25.sql`,
is designed for **observations, events, and already-processed analytical
results** — not to directly absorb a 48 kHz audio stream or a 20 MS/s RF
spectrum. The Big Data layer (§9.1–9.2) exists precisely for that boundary: it
absorbs the raw volume and speed, and only delivers to Firebird the records that
have already been validated, normalized, and temporally aligned — following the
same "insert-if-missing, idempotent" logic already used by the project's other
loaders (`GDX_SKILL_LOAD_*`).

---

## 10. Observation/interpretation separation — methodological governance

This requirement, reiterated throughout the source material (book p. 196, 198,
201; slides 111, 112), is implemented technically, not merely declared:

1. **Capture layer (edge + Big Data, §4–§9)**: produces only physical quantities
   with a unit, instant, location, and uncertainty margin. It never records a
   judgment ("presence", "communication").
2. **Correlation layer (`GDX_PH_ANALYSIS_RESULT`)**: documents that signals
   occurred together within a temporal window, with an algorithm and an anomaly
   score — still a technical fact about coincidence, not an interpretation.
3. **Interpretive layer (`GDX_PH_INTERPRETATION`)**: the **only** layer authorized
   to record a hypothesis (`CATEGORY IN ('ENVIRONMENTAL','PARANORMAL',
   'EQUIPMENT_ARTIFACT','INCONCLUSIVE','OTHER')`), always with an explicit
   `CONFIDENCE_LEVEL` and always as a **separate, additional** record to the
   analysis result that produced it — never replacing or mixing with it.

As the book itself summarizes (p. 198): *"a coincidence between environmental
signals and subjective experiences does not constitute proof of spiritual
phenomena, communication, the presence of entities, or metaphysical causality."*

---

## 11. Data treatment and engineering

Validation/normalization pipeline that runs between the Big Data layer (§9) and
structured persistence (§12), executed as a batch ETL (or near-real-time for
high-priority events):

1. **Source identification** — every record carries the sensor identifier
   (`ID_SENSOR`), the equipment type (`ID_SENSOR_TYPE`), the measured quantity, and
   the unit.
2. **Measurement validation** — discards or flags (never deletes) readings outside
   the sensor's operating range, transmission-failure values, duplicates.
3. **Format transformation** — converts each piece of equipment's native formats
   (e.g. GPS NMEA, raw SDR I/Q, radiometric thermogram) into the normalized
   representation consumed by the database.
4. **Unit normalization** — standardizes units (e.g. µT for all magnetometers,
   regardless of manufacturer).
5. **Temporal alignment** — reconciles each sensor's timestamps (see §6) with the
   session's common timeline.
6. **Inconsistency identification** — flags incomplete records, noise, and known
   interference, without silently discarding them.
7. **Raw-data preservation** — the original version of every measurement remains
   accessible (object storage, §9.2) even after steps 2–6 produce a treated
   version; investigators can always reproduce the analytical chain from the raw
   data.

Every final record, upon reaching structured persistence, carries at minimum: the
sensor identifier, equipment type, measured quantity, observed value, unit,
sampling frequency, acquisition time, location, experimental session, processing
version, and calibration conditions — exactly the set of metadata the book (p.
192) requires for every record.

---

## 12. Structured persistence — database model

The final destination of the treatment chain (§11) is the relational model
**already created and applied** to the project's Firebird database by the script
`C:\Wilson\GoDataX\GDX_HUMAN7\15.environmental.anomalous.phenomena\environmental_anomalous_phenomena_model_firebird25.sql`,
prefixed `GDX_PH_` (Environmental/Phenomena) — this document specifies the
infrastructure that **feeds** that model; the model itself is already implemented
and is not redefined here.

| Table | Role in this specification's chain |
|---|---|
| `GDX_PH_LOCATION` | The delimited experimental environment (§7) |
| `GDX_PH_SENSOR_TYPE` / `GDX_PH_SENSOR` | The equipment catalog (§5) and its installed physical instance |
| `GDX_PH_SENSOR_CALIBRATION` | Calibration history for each sensor — a reliability prerequisite (§14) |
| `GDX_PH_ENVIRONMENT_CONDITION` | Baseline atmospheric/air readings (dimensions 18–19) |
| `GDX_PH_SESSION` | A monitoring session, with a time window and a location |
| `GDX_PH_EVENT` | The discrete occurrence identified within a session — the granularity level at which multi-sensor correlation (§6, §9) is expressed |
| `GDX_PH_OBSERVATION` | A sensor's raw reading associated with an event — the arrival point of the treatment pipeline (§11) |
| `GDX_PH_MEDIA_FILE` | Reference to a raw media file (audio/video/thermogram) preserved in object storage (§9.2), never the binary itself in Firebird |
| `GDX_PH_EVENT_TAG` | Additional free-form tagging on an event |
| `GDX_PH_ANALYSIS_RESULT` | The result of a correlation/anomaly-detection algorithm (§10, level 2) |
| `GDX_PH_INTERPRETATION` | The interpretive hypothesis, always separate and carrying `CONFIDENCE_LEVEL` (§10, level 3) |
| `GDX_PH_REFERENCE_DATA` | Normal reference ranges per dimension/parameter, used to judge what is anomalous |
| `GDX_PH_USER` | System users (operators, investigators) |
| `GDX_PH_EVENT_VAR_MAP` | Interpretive correspondence between a specific environmental event and a metaphysical/psychometric variable (`GDX_PSY_VARIABLE`) — the bridge to §13 |

All 15 tables carry `ID_PERSON` (nullable, FK to `GDX_PSY_PERSON`), allowing any
environmental record to be associated with a specific person when applicable —
without requiring that association when the record is purely environmental (e.g.
a baseline reading with no one present).

---

## 13. Integration with the other GoDataX Human 7 layers

Once in structured persistence (§12), environmental records can feed the same
cross-perspective analyses already established in the framework:

1. **Common timeline with physiological data** — a heart-rate variation
   (`6.cardiac.coherence`, `GDX_CC_HRV_WINDOW`) can be compared, within the same
   temporal window (§6), against acoustic, luminous, thermal, or electromagnetic
   changes recorded in `GDX_PH_EVENT`/`GDX_PH_OBSERVATION`.
2. **Subjective reports** — psychometric responses associated with an observation
   period can be checked for temporal coincidence with environmental events,
   always as a hypothesis to be investigated, never as proof (§10).
3. **Philosophical-metaphysical layer** — `GDX_PH_EVENT_VAR_MAP` allows recording
   that a specific environmental event corresponds, as a hypothesis, to an
   already-cataloged metaphysical variable (`GDX_PSY_VARIABLE`, typically
   `VARIABLE_TYPE='METAPHYSICS'`), including constructs such as the Septenary
   Constitution and Thomas Aquinas's Five Ways.
4. **Data Warehouse and Knowledge Graph** — just like the project's other layers,
   environmental records could, in the future, feed analytical structures
   (`7.multidimensional.database`) and a semantic knowledge graph
   (`9.knowledge.graph`), enabling historical investigations and comparisons
   across studies — not yet implemented for the `GDX_PH_*` module (see the note in
   the project's `Data_Dictionary.md`).

---

## 14. Non-functional requirements

| Requirement | Specification |
|---|---|
| **Reliability** | No reading should be lost due to a momentary network outage (local edge buffer, §9.2) or power loss (UPS + graceful shutdown, §8.2) |
| **Calibration** | Every sensor must have a traceable calibration history (`GDX_PH_SENSOR_CALIBRATION`) before any reading is considered valid for analysis |
| **Scalability** | The architecture must support, without redesign, the addition of new locations/sessions and the "one Raspberry Pi per sensor" variant (§4.4) |
| **Auditability** | Every analytical conclusion must be traceable back to the sensor, the raw record, and the originating procedure (principle §2.3) |
| **Security** | MQTT/Ethernet communication between edge and broker must use authentication and, when traveling outside a trusted local network, TLS; access to the `GDX_PH_*` database follows the same environment-variable credential pattern already used by the project's other modules (never hardcoded) |
| **Observability** | Every component (Pi, Mini PC, broker, databases) must expose basic health metrics (uptime, message-loss rate, clock-synchronization lag) |
| **Continuous availability** | 24×7 operation expected for baseline sessions; active cooling (Pi) and adequate heat dissipation (Mini PC) sized for that regimen |

---

## 15. Implementation roadmap

The specification and the database model are complete (per the source appendix's
own note, p. 185); the following physical and capture implementation phases
remain:

| Phase | Deliverable |
|---|---|
| 1 | Acquisition and test bench for the Raspberry Pi 5 + Mini PC, with one sensor per category (5 categories, §3), to validate the interface mapping (§4.3) |
| 2 | Implementation of time synchronization (§6) — GPS/PPS on the Raspberry Pi 5 as the local NTP server, precision validation |
| 3 | Implementation of the edge capture agent (I²C/SPI/UART/USB reading, SQLite buffer, MQTT publishing) |
| 4 | Deployment of the Big Data layer (§9): MQTT broker, TimescaleDB/InfluxDB, MinIO object storage |
| 5 | Implementation of the treatment ETL (§11) and the load into Firebird `GDX_PH_*` |
| 6 | Gradual expansion: remaining sensors per category, EMI shielding tests (§8.1) in a real environment |
| 7 | Cross integration with `6.cardiac.coherence` and the metaphysical layers (§13) |
| 8 | Extension of the Knowledge Graph (`9.knowledge.graph`) and the Data Warehouse for the `GDX_PH_*` module |

---

## 16. References

- `GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/GoDataXHuman7-Br3.ppt`, slides 105–114:
  "GoDataXh7 PH, the Environmental Bias and Anomalous Phenomena"; "Recording
  Environmental and Anomalous Phenomena"; "Environmental, Energetic & Anomalous
  Phenomena Measurement" (consolidation of dimensions/sensors/applications);
  "Relational Database Model"; "Sensor Integration Architecture — Raspberry Pi 5 +
  Mini PC with interconnected sensors"; "Setup and Data Collection / Time-Aligned
  Data Flows / Correlation and Analysis"; "Potential Communication Interpretation
  Process"; "Instrumental Transcommunication (ITC)".
- `GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/book/Beyond_the_Labyrinth_Livro_Final.pdf`,
  p. 185–201: appendix "GoDataXh7 PH, the Environmental Bias and Anomalous
  Phenomena" — multidimensional environmental observation architecture, temporal
  and spatial dimensions, Big Data, data treatment, database model, environment/
  individual/consciousness integration, full table of the 21 dimensions.
- `C:\Wilson\GoDataX\GDX_HUMAN7\15.environmental.anomalous.phenomena\environmental_anomalous_phenomena_model_firebird25.sql`
  — the script that **creates** the relational model (15 `GDX_PH_*` tables),
  already applied to the project's Firebird database; the basis for the
  persistence specified in §12.
- `C:\Wilson\GoDataX\GDX_HUMAN7\15.environmental.anomalous.phenomena\ph_tables.png`
  — reference diagram of the relational model (same content as slide 109).
