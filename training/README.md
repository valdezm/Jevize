# Training

V0 deliberately collects teacher decisions and real outcomes before training a student.

The first student should learn the meta-task `(state, goal, arbitrary choices) -> distribution over choices`, not a fixed label set.

Next: export JSONL, distill soft distributions, evaluate OOD generalization, calibrate held-out predictions, and promote only when quality gates pass.
