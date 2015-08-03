make_popover = (id, content) ->
  document.getElementById(id).setAttribute "data-toggle", "popover"
  # document.getElementById(id).setAttribute "data-trigger", "focus"
  document.getElementById(id).setAttribute "data-placement", "bottom"
  document.getElementById(id).setAttribute "data-container", "body"
  document.getElementById(id).setAttribute "data-content", content

$(document).ready ->
  make_popover 'phys7a',
    "
    Physics for Scientists and Engineers: Mechanics and wave motion.
    "
  make_popover 'phys7b',
    "
    Physics for Scientists and Engineers: Heat, electricity, and magnetism.
    "
  make_popover 'phys7c',
    "
    Physics for Scientists and Engineers: Electromagnetic waves, optics,
    relativity, and quantum physics.
    "
  make_popover 'phys137a',
    "
    Introduction to the methods of quantum mechanics with
    applications to atomic, molecular, solid state, nuclear and elementary
    particle physics.
    "
  make_popover 'math53',
    "
    Parametric equations and polar coordinates. Vectors in 2- and
    3-dimensional Euclidean spaces. Partial derivatives. Multiple
    integrals. Vector calculus. Theorems of Green, Gauss, and Stokes.
    "
  make_popover 'math54',
    "
    Basic linear algebra; matrix arithmetic and determinants. Vector
    spaces; inner product as spaces. Eigenvalues and eigenvectors; linear
    transformations. Homogeneous ordinary differential equations;
    first-order differential equations with constant coefficients. Fourier
    series and partial differential equations.
    "
  make_popover 'math110',
    "
    Matrices, vector spaces, linear transformations, inner products,
    determinants. Eigenvectors. QR factorization. Quadratic forms and
    Rayleigh's principle. Jordan canonical form, applications. Linear
    functionals.
    "
  make_popover 'math126',
    "
    Waves and diffusion, initial value problems for hyperbolic and
    parabolic equations, boundary value problems for elliptic equations,
    Green's functions, maximum principles, a priori bounds, Fourier
    transform.
    "
  make_popover 'econ140',
    "
    Introduction to problems of observation, estimation, and hypothesis
    testing in economics. This course covers the linear regression model
    and its application to empirical problems in economics.
    "
  make_popover 'cs61a',
    "
    Introduction to programming and computer science. This course exposes
    students to techniques of abstraction at several levels: (a) within a
    programming language, using higher-order functions, manifest types,
    data-directed programming, and message-passing; (b) between programming
    languages, using functional and rule-based languages as examples. It
    also relates these techniques to the practical problems of
    implementation of languages and algorithms on a von Neumann machine.
    There are several significant programming projects.
    "
  make_popover 'cs61b',
    "
    Fundamental dynamic data structures, including linear lists, queues,
    trees, and other linked structures; arrays strings, and hash tables.
    Storage management. Elementary principles of software engineering.
    Abstract data types. Algorithms for sorting and searching. Introduction
    to the Java programming language.
    "
  make_popover 'cs61c',
    "
    The internal organization and operation of digital computers. Machine
    architecture, support for high-level languages (logic, arithmetic,
    instruction sequencing) and operating systems (I/O, interrupts, memory
      management, process switching). Elements of computer logic design.
      Tradeoffs involved in fundamental architectural design decisions.
    "
  make_popover 'cs70',
    "
    Logic, infinity, and induction; applications include undecidability and
    stable marriage problem. Modular arithmetic and GCDs; applications
    include primality testing and cryptography. Polynomials; examples
    include error correcting codes and interpolation. Probability including
    sample spaces, independence, random variables, law of large numbers;
    examples include load balancing, existence arguments, Bayesian
    inference.
    "
  make_popover 'cs150',
    "
    Basic building blocks and design methods to contruct synchronous
    digital systems, such as general purpose processors, hardware
    accelerators, and application specific processors. Representations and
    design methodologies for digital systems. Logic design using
    combinatorial and sequential circuits. Digital system implementation
    considering hardware descriptions languages, computer-aided design
    tools, field-programmable gate array architectures, and CMOS logic
    gates and state elements. Interfaces between peripherals, processor
    hardware, and software. Formal hardware laboratories and substantial
    design project.
    "
  make_popover 'cs170',
    "
    Concept and basic techniques in the design and analysis of algorithms;
    models of computation; lower bounds; algorithms for optimum search
    trees, balanced trees and UNION-FIND algorithms; numerical and
    algebraic algorithms; combinatorial algorithms. Turing machines, how to
    count steps, deterministic and nondeterministic Turing machines,
    NP-completeness. Unsolvable and intractable problems.
    "
  make_popover 'cs188',
    "
    Ideas and techniques underlying the design of intelligent computer
    systems. Topics include search, game playing, knowledge representation,
    inference, planning, reasoning under uncertainty, machine learning,
    robotics, perception, and language understanding.
    "
  make_popover 'cs191',
    "
    This multidisciplinary course provides an introduction to fundamental
    conceptual aspects of quantum mechanics from a computational and
    informational theoretic perspective, as well as physical
    implementations and technological applications of quantum information
    science. Basic sections of quantum algorithms, complexity, and
    cryptography, will be touched upon, as well as pertinent physical
    realizations from nanoscale science and engineering.
    "
  make_popover 'ee20n',
    "
    Mathematical modeling of signals and systems. Continous and discrete
    signals, with applications to audio, images, video, communications, and
    control. State-based models, beginning with automata and evolving to
    LTI systems. Frequency domain models for signals and frequency response
    for systems, and sampling of continuous-time signals. A Matlab-based
      laboratory is an integral part of the course.
    "
  make_popover 'ee40',
    "
    Fundamental circuit concepts and analysis techniques in the context of
    digital electronic circuits. Transient analysis of CMOS logic gates;
    basic integrated-circuit technology and layout.
    "
  make_popover 'ee105',
    "
    This course covers the fundamental circuit and device concepts needed
    to understand analog integrated circuits. After an overview of the
    basic properties of semiconductors, the p-n junction and MOS capacitors
    are described and the MOSFET is modeled as a large-signal device. Two
    port small-signal amplifiers and their realization using single stage
    and multistage CMOS building blocks are discussed. Sinusoidal
    steady-state signals are introduced and the techniques of phasor
    analysis are developed, including impedance and the magnitude and phase
    response of linear circuits. The frequency responses of single and
    multi-stage amplifiers are analyzed. Differential amplifiers are
    introduced.
    "
  make_popover 'ee120',
    "
    Continuous and discrete-time transform analysis techniques with
    illustrative applications. Linear and time-invariant systems, transfer
    functions. Fourier series, Fourier transform, Laplace and Z-transforms.
    Sampling and reconstruction. Solution of differential and difference
    equations using transforms. Frequency response, Bode plots, stability
    analysis. Illustrated by analysis of communication systems and feedback
    control systems.
    "
  make_popover 'ee121',
    "
    Introduction to the basic principles of the design and analysis of
    modern digital communication systems. Topics include source coding,
    channel coding, baseband and passband modulation techniques, receiver
    design, and channel equalization. Applications to design of digital
    telephone modems, compact disks, and digital wireless communication
    systems. Concepts illustrated by a sequence of MATLAB exercises.
    "
  make_popover 'ee123',
    "
    Discrete time signals and systems: Fourier and Z transforms, DFT,
    2-dimensional versions. Digital signal processing topics: flow graphs,
    realizations, FFT, chirp-Z algorithms, Hilbert transform relations,
    quantization effects, linear prediction. Digital filter design methods:
    windowing, frequency sampling, S-to-Z methods, frequency-transformation
    methods, optimization methods, 2-dimensional filter design.
    "
  make_popover 'ee126',
    "
    This course covers the fundamentals of probability and random processes
    useful in fields such as networks, communication, signal processing,
    and control. Sample space, events, probability law. Conditional
    probability. Independence. Random variables. Distribution, density
    functions. Random vectors. Law of large numbers. Central limit theorem.
    Estimation and detection. Markov chains.
    "
  make_popover 'eec128',
    "
    Analysis and synthesis of linear feedback control systems in transform
    and time domains. Control system design by root locus, frequency
    response, and state space methods. Applications to electro-mechanical
    and mechatronics systems.
    "
  make_popover 'ee222',
    '
    Basic graduate course in non-linear systems. Second Order systems.
    Numerical solution methods, the describing function method,
    linearization. Stability - direct and indirect methods of Lyapunov.
    Applications to the Lure problem - Popov, circle criterion.
    Input-Output stability. Additional topics include: bifurcations of
    dynamical systems, introduction to the "geometric" theory of control
    for nonlinear systems, passivity concepts and dissipative dynamical
      systems.
    '
  make_popover 'ee223',
    "
    Parameter and state estimation. System identification. Nonlinear
    filtering. Stochastic control. Adaptive control.
    "
  make_popover 'ee225a',
    "
    Advanced techniques in signal processing. Stochastic signal processing,
    parametric statistical signal models, and adaptive filterings.
    Application to spectral estimation, speech and audio coding, adaptive
    equalization, noise cancellation, echo cancellation, and linear
    prediction.
    "
  make_popover 'ee226a',
    "
    Probability, random variables and their convergence, random processes.
    Filtering of wide sense stationary processes, spectral density, Wiener
    and Kalman filters. Markov processes and Markov chains. Gaussian, birth
    and death, poisson and shot noise processes. Elementary queueing
    analysis. Detection of signals in Gaussian and shot noise, elementary
    parameter estimation.
    "
  make_popover 'ee227at',
    "
    This course offers an introduction to optimization models and their
    applications, ranging from machine learning and statistics to
    decision-making and control, with emphasis on numerically tractable
    problems, such as linear or constrained least-squares optimization.
    "
  make_popover 'ee229a',
    "
    Fundamental bounds of Shannon theory and their application. Source and
    channel coding theorems. Galois field theory, algebraic
    error-correction codes. Private and public-key cryptographic systems.
    "
  $('[data-toggle="popover"]').popover()
