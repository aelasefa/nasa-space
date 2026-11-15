/*
 * Training Academy curriculum: five chapters, each with a short lesson, the name of its
 * simulator and a multiple-choice quiz. Imported unchanged from AmanarII (js/dataset.js),
 * apart from field names and dropping the "Chapter n:" prefix from titles.
 *
 * These are simplified teaching summaries of textbook orbital mechanics and spacecraft
 * engineering. Figures are rounded, typical values, not mission data. `answer` is the
 * index of the correct option.
 */

export interface Question { prompt: string; options: readonly string[]; answer: number; explanation: string }
export interface Chapter {
  id: number; title: string; difficulty: string; simulator: string; lesson: string; questions: readonly Question[]
}

export const curriculum: readonly Chapter[] = [
  {
    "id": 1,
    "title": "Space Environment & Orbit Fundamentals",
    "difficulty": "Easy",
    "simulator": "Interactive 3D Earth Orbit Viewer (LEO vs GEO vs SSO toggle)",
    "lesson": "Low Earth Orbit (LEO, 200–2,000 km) features rapid ~90-minute periods, while Geostationary Orbit (GEO, ~35,786 km) matches Earth's rotational period. Space environments subject vehicles to atomic oxygen erosion, thermal cycles (+120°C in sunlight to -150°C in shadow), and charged particle radiation in the Van Allen belts. Thermal management relies solely on thermal radiation, and circular LEO speed requires ~7.67 km/s.",
    "questions": [
      {
        "prompt": "What distinguishes Low Earth Orbit (LEO) from Geostationary Orbit (GEO)?",
        "options": [
          "LEO orbits at ~35,786 km; GEO orbits at 200–2,000 km.",
          "LEO orbits at 200–2,000 km with ~90-min periods; GEO orbits at ~35,786 km matching Earth's rotation.",
          "GEO is only used for polar observation.",
          "LEO requires continuous interplanetary burns."
        ],
        "answer": 1,
        "explanation": "LEO spacecraft orbit rapidly close to Earth (~90–120 min), while GEO satellites hover above a fixed longitude at ~35,786 km."
      },
      {
        "prompt": "Which main space environmental factor causes material degradation and orbital decay in LEO?",
        "options": [
          "Solar flare gravity.",
          "High pressure.",
          "Atomic oxygen and atmospheric drag.",
          "Magnetic levitation."
        ],
        "answer": 2,
        "explanation": "Even at 400 km, residual atomic oxygen erodes spacecraft surfaces and creates drag, causing altitude loss."
      },
      {
        "prompt": "Why do Sun-Synchronous Orbits (SSO) appeal to Earth observation missions?",
        "options": [
          "They require zero fuel.",
          "The satellite passes over any given point on Earth's surface at the same local solar time.",
          "They pass through the core of the Van Allen belts.",
          "They remain permanently over the equator."
        ],
        "answer": 1,
        "explanation": "SSO maintains consistent sun-angle lighting across images, ideal for optical monitoring."
      },
      {
        "prompt": "What is the primary danger posed by the Van Allen Radiation Belts?",
        "options": [
          "High atmospheric drag.",
          "Extreme aerodynamic heat.",
          "Energetic charged particles causing Single Event Upsets (SEU) in avionics.",
          "Gravitational collapse."
        ],
        "answer": 2,
        "explanation": "Trapped protons and electrons can flip bits in spacecraft memory or damage solar cells."
      },
      {
        "prompt": "Thermal management in space must rely strictly on which heat transfer mechanism?",
        "options": [
          "Conduction through air.",
          "Convection currents.",
          "Thermal Radiation.",
          "Atmospheric cooling."
        ],
        "answer": 2,
        "explanation": "In a vacuum, conduction and convection cannot transfer heat to the environment; radiation via radiators is the only path."
      },
      {
        "prompt": "What velocity is required to maintain a circular orbit at low Earth altitude (~400 km)?",
        "options": [
          "~1.5 km/s",
          "~7.67 km/s",
          "~11.2 km/s",
          "~30 km/s"
        ],
        "answer": 1,
        "explanation": "Circular orbital speed in LEO is approximately 7.7 km/s (v = sqrt(mu/r))."
      },
      {
        "prompt": "Earth's escape velocity from the surface is approximately:",
        "options": [
          "7.9 km/s",
          "11.2 km/s",
          "42.1 km/s",
          "3.0 km/s"
        ],
        "answer": 1,
        "explanation": "Escape velocity requires 11.2 km/s to break free from Earth's gravity well."
      },
      {
        "prompt": "What causes thermal cycling on an Earth-orbiting spacecraft?",
        "options": [
          "Engine thruster firings.",
          "Rapid transitions between direct sunlight (~+120°C) and Earth's shadow eclipse (~-150°C).",
          "Solar panel rotation speed.",
          "Cosmic ray impact."
        ],
        "answer": 1,
        "explanation": "Entering Earth's shadow causes severe thermal drops every ~90 minutes."
      },
      {
        "prompt": "Polar orbits are defined by an inclination close to:",
        "options": [
          "0°",
          "45°",
          "90°",
          "180°"
        ],
        "answer": 2,
        "explanation": "An inclination of 90° carries the satellite directly over the North and South poles."
      },
      {
        "prompt": "The region of space surrounding Earth shielded by its magnetic field is called the:",
        "options": [
          "Ionosphere",
          "Magnetosphere",
          "Stratosphere",
          "Heliosphere"
        ],
        "answer": 1,
        "explanation": "The magnetosphere deflects the majority of solar wind particles away from Earth orbit."
      }
    ]
  },
  {
    "id": 2,
    "title": "Applied Orbital Mechanics & Trajectories",
    "difficulty": "Medium-Easy",
    "simulator": "Dynamic Keplerian Ellipse Editor (Adjust Semi-Major Axis a & Eccentricity e)",
    "lesson": "Orbital geometry is governed by 6 classical Keplerian elements (a, e, i, Omega, omega, nu). The Hohmann transfer is the most fuel-efficient co-planar maneuver between circular orbits. Velocity is highest at perigee (Kepler's 2nd Law), while plane changes are most fuel-efficient at apogee where orbital velocity is lowest.",
    "questions": [
      {
        "prompt": "Which orbital maneuver transfers a spacecraft between two coplanar circular orbits using the lowest total Delta-V?",
        "options": [
          "Continuous radial burn.",
          "Bi-elliptic transfer with infinite apogee.",
          "Hohmann Transfer.",
          "Constant thrust spiral."
        ],
        "answer": 2,
        "explanation": "A Hohmann transfer utilizes an elliptical orbit tangent to both the initial and final circular orbits."
      },
      {
        "prompt": "How many classical Keplerian orbital elements are required to uniquely define a spacecraft's orbit in 3D space?",
        "options": [
          "3",
          "4",
          "6 (a, e, i, Omega, omega, nu)",
          "8"
        ],
        "answer": 2,
        "explanation": "Six parameters specify orbital size (a), shape (e), orientation (i, Omega, omega), and location (nu)."
      },
      {
        "prompt": "Kepler's Second Law (Law of Equal Areas) dictates that a spacecraft moves fastest at:",
        "options": [
          "Apogee / Perihelion.",
          "Perigee / Perihelion.",
          "Semi-minor axis intersection.",
          "True anomaly of 90°."
        ],
        "answer": 1,
        "explanation": "To sweep out equal areas in equal time, velocity is highest at closest approach (perigee)."
      },
      {
        "prompt": "What is the shape of an orbit with an eccentricity (e) equal to 0?",
        "options": [
          "Ellipse",
          "Parabola",
          "Circle",
          "Hyperbola"
        ],
        "answer": 2,
        "explanation": "e = 0 defines a circular orbit; 0 < e < 1 defines an ellipse."
      },
      {
        "prompt": "To raise the apogee of an orbit, where should the spacecraft perform a prograde burn?",
        "options": [
          "At apogee.",
          "At perigee.",
          "At the ascending node.",
          "At a 90° true anomaly."
        ],
        "answer": 1,
        "explanation": "Firing prograde at perigee adds energy, pushing the opposite side (apogee) further out."
      },
      {
        "prompt": "What does a Delta-V budget represent in mission design?",
        "options": [
          "Total monetary cost of fuel.",
          "Total impulse velocity change required to perform all planned orbital maneuvers.",
          "Electrical battery reserve.",
          "Total flight duration in days."
        ],
        "answer": 1,
        "explanation": "Delta-V measures the scalar sum of velocity changes needed for launch, corrections, and orbital insertion."
      },
      {
        "prompt": "A hyperbolic trajectory (e > 1) signifies that the spacecraft is:",
        "options": [
          "Bound to Earth's gravity.",
          "On an un-bound escape trajectory relative to the primary body.",
          "Decelerating toward orbital decay.",
          "Stationary relative to Earth."
        ],
        "answer": 1,
        "explanation": "e > 1 means orbital energy is positive, escaping the gravitational attraction of the central body."
      },
      {
        "prompt": "Plane change maneuvers (Delta i) are most fuel-efficient when executed at:",
        "options": [
          "Highest velocity at perigee.",
          "Lowest velocity at apogee or orbital nodes.",
          "Mid-transfer orbit.",
          "Any point along the orbit equally."
        ],
        "answer": 1,
        "explanation": "Delta-V_plane = 2 * v * sin(Delta_i / 2). Lower velocity (v) minimizes required thrust energy."
      },
      {
        "prompt": "What orbital mechanic concept uses a planet's gravitational well to boost spacecraft velocity without burning fuel?",
        "options": [
          "Aerocapture.",
          "Planetary Fly-by / Gravity Assist (Slingshot).",
          "Hohmann brake.",
          "Stationkeeping."
        ],
        "answer": 1,
        "explanation": "Gravity assists exchange angular momentum with orbiting planets to alter spacecraft speed and direction."
      },
      {
        "prompt": "The point in an elliptical Earth orbit furthest from Earth's center is called:",
        "options": [
          "Perigee",
          "Apogee",
          "Perihelion",
          "Apoapsis of Mars"
        ],
        "answer": 1,
        "explanation": "Apogee is the point of maximum distance in an Earth-centric orbit."
      }
    ]
  },
  {
    "id": 3,
    "title": "Spacecraft Subsystems & Propulsion",
    "difficulty": "Medium",
    "simulator": "Subsystem Trade-off Simulator (Power vs Weight vs Thrust Balance)",
    "lesson": "Electric/ion propulsion provides high Specific Impulse (Isp > 3000s) at low thrust levels. Attitude Determination & Control Systems (ADCS) combine sensors (Star Trackers, Gyroscopes) with actuators (Reaction Wheels, Magnetorquers). Reaction wheels store angular momentum internally but require thruster desaturation burns when environmental disturbance torques cause motor saturation.",
    "questions": [
      {
        "prompt": "Which propulsion type offers high specific impulse (Isp) but very low thrust, ideal for deep-space cruise?",
        "options": [
          "Solid rocket engine.",
          "Monopropellant hydrazine.",
          "Electric / Ion Propulsion.",
          "Bipropellant chemical rocket."
        ],
        "answer": 2,
        "explanation": "Electric thrusters achieve Isp > 3000 s through high exhaust velocity, saving mass despite low immediate thrust."
      },
      {
        "prompt": "What primary hardware actuator provides momentum storage for 3-axis attitude control without expending propellant?",
        "options": [
          "Magnetorquer rods.",
          "Reaction Wheels.",
          "Cold gas RCS jets.",
          "Solar sails."
        ],
        "answer": 1,
        "explanation": "Spinning internal reaction wheels exchanges angular momentum with the spacecraft chassis to adjust orientation."
      },
      {
        "prompt": "What phenomenon causes reaction wheels to reach maximum speed, requiring a thruster 'desaturation' burn?",
        "options": [
          "Battery drain.",
          "Solar array misalignment.",
          "Environmental disturbance torque accumulation.",
          "Doppler shift."
        ],
        "answer": 2,
        "explanation": "Continuous external torques force reaction wheels to speed up until they hit RPM limits (saturation)."
      },
      {
        "prompt": "Specific Impulse (Isp) is measured in units of:",
        "options": [
          "Meters per second squared (m/s^2).",
          "Newton-meters (N*m).",
          "Seconds (s).",
          "Joules per kilogram (J/kg)."
        ],
        "answer": 2,
        "explanation": "Isp = F / (m_dot * g_0), expressing engine efficiency in seconds."
      },
      {
        "prompt": "Which ADCS sensor measures spacecraft rotation rate directly using optical interference?",
        "options": [
          "Star Tracker.",
          "Sun Sensor.",
          "Fiber Optic Gyroscope (FOG).",
          "Magnetometer."
        ],
        "answer": 2,
        "explanation": "Gyroscopes measure angular velocity rates around vehicle axes."
      },
      {
        "prompt": "What solar panel technology provides the highest energy conversion efficiency for space applications?",
        "options": [
          "Single-crystal silicon.",
          "Multi-junction Gallium Arsenide (GaAs) photovoltaic cells.",
          "Thin-film cadmium telluride.",
          "Thermoelectric couples."
        ],
        "answer": 1,
        "explanation": "Multi-junction GaAs cells capture multiple light wavelengths, reaching >30% efficiency in space."
      },
      {
        "prompt": "The primary purpose of a spacecraft's Thermal Control System (TCS) heat pipes is to:",
        "options": [
          "Generate power from waste heat.",
          "Transport heat from internal high-power electronics to external radiators.",
          "Burn excess propellants.",
          "Cool the solar panels."
        ],
        "answer": 1,
        "explanation": "Liquid-phase heat pipes passively transfer internal heat loads across distances to radiator surfaces."
      },
      {
        "prompt": "In radio communications, doubling the distance (2D) between spacecraft and ground station reduces signal power by a factor of:",
        "options": [
          "2",
          "4 (Inverse-square law, 1/R^2)",
          "8",
          "16"
        ],
        "answer": 1,
        "explanation": "Free-space path loss follows the inverse-square law; doubling distance drops power by 1/2^2 = 1/4 (-6 dB)."
      },
      {
        "prompt": "Magnetorquers generate attitude control torque by interacting with:",
        "options": [
          "Solar radiation pressure.",
          "Atmospheric pressure.",
          "Earth's ambient magnetic field.",
          "Gravitational tides."
        ],
        "answer": 2,
        "explanation": "Electromagnet coils create a magnetic dipole that pushes against planetary magnetic lines."
      },
      {
        "prompt": "A Star Tracker determines spacecraft orientation by:",
        "options": [
          "Tracking the position of the Sun relative to Earth.",
          "Matching optical star pattern images against an onboard catalog database.",
          "Measuring magnetic field angles.",
          "Radar altimetry."
        ],
        "answer": 1,
        "explanation": "Star trackers provide high precision arcsecond-level 3-axis orientation by recognizing constellations."
      }
    ]
  },
  {
    "id": 4,
    "title": "Rendezvous & Proximity Operations",
    "difficulty": "Hard",
    "simulator": "3D Docking Cone Simulator (Align Vector, Match Velocity, Hard-Lock)",
    "lesson": "Relative motion near the ISS is modeled in the Local Vertical Local Horizontal (LVLH) Hill frame using Clohessy-Wiltshire equations. Counterintuitively, burning prograde toward a target ahead raises your orbit into a higher, slower period, dropping you further behind. Catching up requires burning retrograde to drop into a lower, faster phasing orbit. Final docking alignment along V-bar or R-bar requires relative velocity < 0.1 m/s.",
    "questions": [
      {
        "prompt": "What mathematical frame is typically used to analyze relative motion between a chaser spacecraft and the ISS during approach?",
        "options": [
          "Inertial J2000 frame.",
          "Local Vertical Local Horizontal (LVLH) Hill/Clohessy-Wiltshire frame.",
          "Heliocentric Cartesian frame.",
          "Geodetic WGS84 frame."
        ],
        "answer": 1,
        "explanation": "The LVLH frame rotates with the target (ISS), making relative trajectory equations linear."
      },
      {
        "prompt": "If a chaser spacecraft is 1 km behind the ISS in the same orbit, firing thrusters directly forward toward the ISS will cause the chaser to:",
        "options": [
          "Move straight forward and dock faster.",
          "Gain altitude into a higher orbit and drop further behind the ISS.",
          "Stop in place immediately.",
          "Drop into a lower, faster orbit."
        ],
        "answer": 1,
        "explanation": "Adding speed raises orbital energy and period; the spacecraft moves to a higher, slower orbit!"
      },
      {
        "prompt": "To catch up to a target spacecraft orbiting ahead of you in the same circular orbit, you must:",
        "options": [
          "Burn prograde to raise altitude.",
          "Burn retrograde to drop into a lower, faster phasing orbit.",
          "Turn off all attitude controls.",
          "Increase payload mass."
        ],
        "answer": 1,
        "explanation": "Lower orbits have shorter periods (T proportional to a^(3/2)), allowing the chaser to overtake the target."
      },
      {
        "prompt": "What is the name of the designated virtual safety perimeter surrounding the ISS (typically 200m) where strict approach rules apply?",
        "options": [
          "Orbital Zone.",
          "Keep-Out Sphere (KOS) / Approach Ellipsoid.",
          "Hazard Boundary.",
          "Magneto-pause."
        ],
        "answer": 1,
        "explanation": "Entry into the Keep-Out Sphere requires explicit clearance and manual/autonomous safety hold capability."
      },
      {
        "prompt": "During final docking approach along the V-bar (velocity vector), relative velocity must be kept:",
        "options": [
          "Equal to Earth's rotation speed.",
          "Extremely low (typically < 0.1 m/s) to prevent structural damage.",
          "Above escape velocity.",
          "At maximum thruster output."
        ],
        "answer": 1,
        "explanation": "Low relative velocity ensures soft capture mechanisms latch safely without damaging docking rings."
      },
      {
        "prompt": "Relative navigation within 50 meters of the ISS relies heavily on which optical sensor system?",
        "options": [
          "GPS receiver only.",
          "LiDAR and 3D Optical Rendezvous Sensors.",
          "Magnetometer.",
          "Deep Space Network radar."
        ],
        "answer": 1,
        "explanation": "LiDAR bounces laser pulses to yield millimeter-accurate range, range-rate, and relative attitude metrics."
      },
      {
        "prompt": "What is the 'R-bar' approach direction in ISS proximity operations?",
        "options": [
          "Approach along the orbital velocity vector.",
          "Approach along the Earth radial line connecting the ISS to Earth's center.",
          "Approach perpendicular to the orbital plane.",
          "Random diagonal vector."
        ],
        "answer": 1,
        "explanation": "R-bar runs along the Earth radius vector; V-bar runs along the orbital velocity vector."
      },
      {
        "prompt": "If docking alignment strays outside the structural capture cone, automated safety protocol mandates executing a:",
        "options": [
          "Hohmann transfer.",
          "Abort / Breakaway Maneuver away from the target.",
          "Main engine retrograde burn.",
          "Full power shutoff."
        ],
        "answer": 1,
        "explanation": "An abort burn pushes the chaser onto a safe trajectory clear of the target's path."
      },
      {
        "prompt": "The Clohessy-Wiltshire (CW) equations assume that:",
        "options": [
          "Gravity is zero.",
          "Distance between target and chaser is much smaller than the orbital radius, and the target orbit is circular.",
          "The target is moving at light speed.",
          "Thrusters operate continuously."
        ],
        "answer": 1,
        "explanation": "CW equations linearize relative motion for close-proximity targets in circular orbits."
      },
      {
        "prompt": "What final phase confirms mechanical connection between two spacecraft before pressurization?",
        "options": [
          "Phasing burn.",
          "Hard Lock (latching hooks engaged).",
          "Far-field navigation.",
          "Atmospheric re-entry."
        ],
        "answer": 1,
        "explanation": "Hard lock drives mechanical latches home to form a vacuum seal between docking hatches."
      }
    ]
  },
  {
    "id": 5,
    "title": "Space Operations, Risks & Sustainability",
    "difficulty": "Advanced",
    "simulator": "Kessler Syndrome Debris Chain Simulator & De-orbit Propulsion Calculator",
    "lesson": "Mission ops begins with Launch and Early Orbit Phase (LEOP). Space sustainability mandates de-orbiting LEO satellites within 5 years post-mission to prevent Kessler Syndrome cascading collisions. GEO satellites are boosted into a graveyard orbit (~300 km above GEO). End-of-life passivation requires discharging stored electrical energy and depressurizing propellant tanks to prevent catastrophic accidental breakups.",
    "questions": [
      {
        "prompt": "What does the acronym LEOP stand for in satellite mission operations?",
        "options": [
          "Low Energy Orbital Path.",
          "Launch and Early Orbit Phase.",
          "Linear Eclipse Operations Protocol.",
          "Long-term Exo-Atmospheric Program."
        ],
        "answer": 1,
        "explanation": "LEOP covers deployment, solar array extension, initial stabilization, and health checks after rocket separation."
      },
      {
        "prompt": "The runaway cascade phenomenon where space debris collisions generate exponentially more debris is known as:",
        "options": [
          "Tsiolkovsky Effect.",
          "Kessler Syndrome.",
          "Van Allen Instability.",
          "Lagrange Cascade."
        ],
        "answer": 1,
        "explanation": "Kessler Syndrome describes a density threshold where debris collisions trigger self-sustaining cascading fragmentation."
      },
      {
        "prompt": "According to international space sustainability guidelines, LEO satellites should de-orbit within how many years post-mission?",
        "options": [
          "1 year.",
          "5 years (updated from the historical 25-year rule).",
          "100 years.",
          "Indefinitely."
        ],
        "answer": 1,
        "explanation": "Modern guidelines mandate removing dead satellites within 5 years to protect LEO orbits."
      },
      {
        "prompt": "What operation is performed at the end of a GEO communications satellite's operational lifecycle?",
        "options": [
          "Direct re-entry into Earth's atmosphere.",
          "Boost into a higher 'Graveyard Orbit' (~300 km above GEO).",
          "De-orbit into the Pacific Ocean.",
          "Detonation in place."
        ],
        "answer": 1,
        "explanation": "GEO satellites lack fuel for atmospheric re-entry, so they are parked ~300 km higher in a graveyard orbit."
      },
      {
        "prompt": "In mission risk analysis, a Single Point of Failure (SPOF) is best mitigated by:",
        "options": [
          "Increasing rocket propellant mass.",
          "Incorporating hardware redundancy (e.g., dual fault-tolerant computers).",
          "Flying at higher orbital velocity.",
          "Lowering communication frequency."
        ],
        "answer": 1,
        "explanation": "Redundant backup systems ensure mission survival if a primary component fails."
      },
      {
        "prompt": "What ground segment system processes raw telemetry data received from an orbiting satellite?",
        "options": [
          "Payload Launcher.",
          "Mission Control / Ground Operations Center.",
          "Star Tracker.",
          "Apogee Kick Motor."
        ],
        "answer": 1,
        "explanation": "Ground stations receive RF downlinks and pass telemetry to Mission Control monitoring suites."
      },
      {
        "prompt": "A Conjunction Assessment Warning indicates that:",
        "options": [
          "The solar panels are overheating.",
          "A high probability of close approach / collision with another object or space debris.",
          "The battery has reached 0% charge.",
          "Ground station signal is lost."
        ],
        "answer": 1,
        "explanation": "Conjunction warnings trigger Collision Avoidance Maneuvers (CAM) to alter the satellite's path."
      },
      {
        "prompt": "Passivation of a spacecraft at the end of its life involves:",
        "options": [
          "Formatting memory drives.",
          "Depressurizing tanks and discharging remaining electrical energy to prevent explosions.",
          "Turning on all payload cameras.",
          "Painting the solar panels black."
        ],
        "answer": 1,
        "explanation": "Passivation removes residual energy sources (fuel, pressurized gas, batteries) to avoid accidental breakups."
      },
      {
        "prompt": "Safe Mode on a spacecraft is automatically triggered when:",
        "options": [
          "The mission reaches 100% completion.",
          "An unrecoverable anomaly or critical fault threatens spacecraft survival.",
          "The satellite passes over the equator.",
          "Fuel levels reach 50%."
        ],
        "answer": 1,
        "explanation": "Safe Mode sheds payload power loads, points solar arrays at the Sun, and awaits ground commands."
      },
      {
        "prompt": "What propulsion technique uses atmospheric drag at perigee to reduce apogee altitude over multiple orbits without consuming propellant?",
        "options": [
          "Ion acceleration.",
          "Aerobraking.",
          "Gravity gradient tilt.",
          "Solar pressure boost."
        ],
        "answer": 1,
        "explanation": "Aerobraking uses upper atmospheric drag to shape the orbit gracefully, saving massive amounts of fuel."
      }
    ]
  }
]
