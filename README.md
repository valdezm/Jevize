# Jevize

> **Can repeated general reasoning be compiled into cheaper inference without losing the ability to handle novelty?**

Jevize is an experimental **reasoning compiler** and learned decision runtime. It explores a simple architectural idea: large generative models should not necessarily be the CPU for every cognitive operation in an agent.

Instead, use a powerful general model when a problem is novel, ambiguous, or requires synthesis; record those decisions and their real outcomes; continuously distill repeated decision patterns into small, cheap local models; and escalate back to the general model whenever the student is uncertain or out of distribution.

The long-term goal is not merely a faster classifier. It is a hierarchy in which **expensive intelligence creates and revises abstractions while cheap learned decision models navigate them**.

---

## Where the idea came from

Jevize was inspired by the discussion around Jev-style inference: treating a transformer as a dynamic decision engine rather than always asking it to autoregressively generate language.

A conventional classifier learns a fixed mapping such as:

```text
input -> fraud | refund | support
```

Changing the classes often means changing or retraining the classifier.

A Jev-like interface instead looks like:

```text
(state, question/goal, arbitrary choices) -> probability distribution over choices
```

The candidate classes are supplied **at inference time**. They might be:

```text
fraud | legitimate | uncertain
```

and on the next request:

```text
postgres | redis | clickhouse | elasticsearch
```

and on the next:

```text
click | scroll | type | wait | ask_user
```

No task-specific class set is baked into the public interface.

This is important because the choices do not have to represent semantic labels. They can represent **the actions currently possible in a program**.

That means the class space can become a dynamic control-flow graph.

---

## What is and is not novel

Zero-shot classification, natural-language labels, NLI-style classification, constrained decoding, logit inspection, and using LLMs as classifiers all predate Jev.

The interesting architectural observation is different:

> If an application needs a bounded decision, why force a generative model through a string-generation interface?

Instead of:

```text
input -> transformer -> token -> token -> token -> JSON -> parser -> validator
```

a decision-oriented system can aim for:

```text
state + allowed alternatives -> model -> scores/probabilities -> decision
```

Conceptually, applications often want this:

```ts
decide<T>(context, choices: T[]): ProbabilityDistribution<T>
```

rather than this:

```ts
generate(context): string
```

Jevize treats that distinction as an architectural primitive rather than as a prompt trick.

---

## Jev vs open Jev-like approaches

The official Jev implementation is closed source, so its internal architecture and training recipe should not be assumed.

Open approaches generally fall into two families.

### 1. Use an existing LLM as the decision engine

```text
state + choices
      |
      v
small/local LLM
      |
  logits / constrained answer
      |
      v
probabilities
```

The LLM is still the underlying semantic engine, but the system uses it for bounded inference instead of unrestricted generation.

### 2. Distill a teacher into a smaller student

```text
large teacher
     |
 decisions / distributions
     v
training corpus
     |
     v
small student
```

The student can then perform cheap runtime decisions without invoking the large teacher for every request.

Jevize is primarily interested in the second approach **plus continuous escalation and retraining**.

---

# The core Jevize hypothesis

Do not try to replace the general model completely.

Treat it as an interpreter for novel reasoning, and progressively **compile repeated reasoning into cheaper computation**.

```text
                         GENERAL MODEL
                       (local teacher)
                              |
                  novel / hard decisions
                              |
                              v
                      EXPERIENCE STORE
                    /        |          \
                state     decision     outcome
                              |
                         distillation
                              |
                              v
                           STUDENT
                              |
                    routine decisions
                              |
                   +----------+----------+
                   |                     |
              confident              uncertain/OOD
                   |                     |
                   v                     v
                 ACT              GENERAL MODEL
                                         |
                                  learn this case
```

This is similar to a **JIT compiler for reasoning**:

- the teacher is the flexible interpreter;
- repeated cognitive paths become training data;
- students are compiled fast paths;
- uncertainty is a cache miss;
- the general model handles the miss;
- successful new behavior becomes future training material.

---

# Why this matters for agents and tool calling

Today's agents often ask a large autoregressive model to do everything:

```text
planner + router + controller + evaluator + generator
```

For tool-heavy agents, many of those operations are bounded decisions rather than language-generation problems.

Consider computer use:

```text
screenshot/state
      |
      v
What action best advances the goal?

- click Orders
- click Account
- search
- scroll
- stop
```

After the action, the world changes and therefore the available action set changes:

```text
- click latest order
- search orders
- go back
- stop
```

Then again:

```text
- inspect tracking
- report delivered
- report delayed
- ask user
```

The model is navigating a dynamically generated action graph rather than emitting arbitrary prose.

This suggests a cleaner separation:

```text
LLM / frontier model
    = planning, synthesis, novel reasoning, replanning

Jevize decision layer
    = routing, branching, evaluation, control

Deterministic software
    = execution, permissions, invariants

Tools
    = effects on the world
```

---

# Hierarchical learned control flow

The especially interesting possibility is making decisions at multiple levels of abstraction.

For example, given the goal:

```text
Fix the failing production deployment
```

### Level 1 - strategy

```text
inspect deployment
inspect recent code changes
inspect infrastructure
rollback
ask engineer
```

### Level 2 - tactic

If `inspect deployment` wins:

```text
inspect logs
inspect health checks
inspect deployment history
compare environments
```

### Level 3 - tool

If `inspect logs` wins:

```text
kubectl logs
Datadog
CloudWatch
local logs
```

### Level 4 - concrete action

```text
fetch pod A logs
fetch pod B logs
inspect previous container
```

The resulting system resembles:

```text
                     GOAL
                      |
                      v
               GENERAL MODEL
              create/revise plan
                      |
                possible paths
                      |
                      v
                  DECISION
                  /   |   \
                 /    |    \
             path A path B path C
                      |
                  DECISION
                  /   |   \
                 v    v    v
               tool tool escalate
                         to teacher
```

The general model need not reason from scratch after every tiny environmental transition.

---

# Uncertainty controls computation

Probabilities are not merely UI decoration. They can determine how much intelligence the system spends.

Suppose a student returns:

```json
{
  "inspect_logs": 0.96,
  "rerun": 0.02,
  "inspect_diff": 0.015,
  "ask_human": 0.005
}
```

The runtime might execute immediately.

But:

```json
{
  "delete_resource": 0.53,
  "disable_resource": 0.31,
  "ask_human": 0.14,
  "do_nothing": 0.02
}
```

should trigger stronger reasoning or human confirmation.

Conceptually:

```text
                    student decision
                           |
                     confidence?
                           |
             +-------------+-------------+
             |             |             |
           high         medium          low
             |             |             |
             v             v             v
          execute       teacher      human/replan
```

Real systems should also consider action risk and reversibility rather than relying on a confidence threshold alone.

This makes **calibration** extremely important. A neural network producing `0.97` is not automatically equivalent to a decision being correct 97% of the time. Jevize therefore treats calibration as a first-class evaluation problem.

---

# Teacher distillation

A naive distilled classifier might learn:

```text
support ticket -> refund | fraud | support
```

That is useful, but it loses the most interesting Jev-like property.

Jevize instead wants the student to learn the meta-task:

```text
(state, goal/question, arbitrary natural-language choices)
                         |
                         v
             distribution over choices
```

This is significantly harder because the student must generalize to choices and tasks it did not see verbatim during training.

That is why evaluation must include **out-of-distribution tasks and unseen choice sets**, not just random train/test splits from one domain.

---

# Continuous distillation

A static distillation run is only the beginning.

The intended loop is:

```text
                  TEACHER
                     |
              difficult cases
                     |
                     v
               EXPERIENCE DB <----------+
              /     |      \             |
          state   choice   outcome        |
                     |                    |
                     v                    |
                  TRAIN                   |
                     |                    |
                     v                    |
               NEW STUDENT               |
                     |                    |
                  deploy                  |
                     |                    |
              uncertain/OOD -------------+
```

Retraining does not have to happen literally every day. A better trigger may be accumulated hard examples, distribution drift, degraded calibration, new domains, or enough new outcome data to justify a refresh.

A daily refresh is nevertheless a perfectly reasonable experiment on local hardware if training is cheap enough.

---

# Learn from outcomes, not only the teacher

Pure distillation learns:

```text
What would the teacher choose?
```

But an agent eventually has better evidence available:

```text
teacher prediction
+ student prediction
+ selected action
+ actual tool result
+ task success/failure
+ human correction
```

For example:

```text
State:
production latency increased

Decision distribution:
restart_service   .15
scale_service     .61
inspect_database  .19
rollback          .05

Action:
scale_service

Observed outcome:
latency decreased 74%
```

This allows the system to eventually optimize toward:

> **Which decisions actually work in this environment?**

rather than merely imitating a teacher forever.

A specialized student could therefore eventually outperform its teacher on frequently observed local tasks.

---

# Specialized students vs one universal student

Jevize does not assume that one tiny model must become a universal replacement for the teacher.

A potentially stronger architecture is:

```text
                   GENERAL INTELLIGENCE
                       local teacher
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
          browser          coding         support
          student          student        student
             |              |              |
        cheap control  cheap control  cheap control
```

The teacher retains generality while domain students crystallize repeated reasoning patterns.

A router can eventually choose between students and escalate when none is appropriate.

---

# Teacher displacement

The primary systems metric is not raw classification accuracy.

It is:

> **Teacher displacement at constant task quality.**

An ideal trajectory might look like:

```text
Day 1
Teacher calls: 100%
Student calls:   0%

After learning
Teacher calls:  34%
Student calls:  66%

Later
Teacher calls:   6%
Student calls:  94%
```

That number is meaningless unless quality remains stable, so Jevize should track at least:

- task success rate;
- teacher/student agreement;
- teacher escalation rate;
- student coverage;
- out-of-distribution rate;
- calibration error;
- latency;
- compute/tokens avoided;
- outcome quality;
- failure severity;
- performance by domain and action risk.

---

# Current V0 architecture

The repository intentionally starts with the teacher rather than prematurely training a student.

```text
state + goal + dynamic choices
            |
            v
      DecisionService
            |
            v
      LM Studio teacher
            |
            v
 probability distribution
            |
            +------> SQLite experience store
```

Why start this way?

Because the student needs a meaningful corpus and baseline. Training a student before collecting representative teacher traces and outcomes would optimize against an invented distribution.

V0 therefore focuses on generating the data required for the real experiment.

---

# Hardware / local-first target

The initial development environment is intentionally local-first:

- AMD Ryzen AI Max+ 390 class machine;
- 128 GB unified/system memory;
- LM Studio;
- locally hosted teacher models;
- local SQLite experience storage;
- eventually locally trained and served students.

LM Studio exposes an OpenAI-compatible API, so Jevize treats the teacher as a replaceable provider rather than coupling the architecture permanently to LM Studio.

A frontier cloud model can later be used as another teacher without changing the core decision contract.

---

# Stable public abstraction

The core contract should remain simple even while everything behind it changes:

```ts
const result = await decide({
  state: {
    currentPage: "github-pr",
    ci: "failed",
    changedFiles: 17
  },
  goal: "Resolve the failing CI run",
  choices: [
    { id: "inspect_logs", description: "Inspect failed CI logs" },
    { id: "rerun", description: "Rerun failed jobs" },
    { id: "inspect_diff", description: "Inspect code changes" },
    { id: "ask_human", description: "Escalate to the developer" }
  ]
});
```

Example response:

```json
{
  "decision": "inspect_logs",
  "probabilities": {
    "inspect_logs": 0.82,
    "inspect_diff": 0.11,
    "rerun": 0.05,
    "ask_human": 0.02
  },
  "model": "student-v17",
  "confidence": 0.82,
  "source": "student",
  "escalated": false
}
```

The teacher implementation, student architecture, storage layer, calibration technique, and routing policy should all be replaceable behind this interface.

---

# V0 API

### `POST /v1/decide`

Accepts state, a goal, and 2-255 dynamic choices. V0 always uses the LM Studio teacher and records the resulting experience.

### `POST /v1/outcomes`

Attaches real-world success/failure and arbitrary outcome data to a previous decision.

### `GET /v1/metrics`

Reports the initial runtime metrics, including teacher calls, student calls, teacher displacement, recorded outcomes, and success rate.

### `GET /health`

Basic service health check.

---

# Running V0

Requirements:

- Node.js 22+
- LM Studio with its local server enabled

```bash
git clone git@github.com:valdezm/Jevize.git
cd Jevize
cp .env.example .env
npm install
npm run dev
```

Configure `.env`:

```env
PORT=3000
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_MODEL=local-model
DATABASE_PATH=./data/jevize.db
```

Replace `local-model` with the identifier of the model loaded in LM Studio.

Example request:

```bash
curl -X POST http://localhost:3000/v1/decide \
  -H 'content-type: application/json' \
  -d '{
    "goal":"Resolve a failing CI run",
    "state":{"ci":"failed","changedFiles":17},
    "choices":[
      {"id":"inspect_logs","description":"Inspect failed CI logs"},
      {"id":"rerun","description":"Rerun failed jobs"},
      {"id":"inspect_diff","description":"Inspect code changes"},
      {"id":"ask_human","description":"Escalate to the developer"}
    ]
  }'
```

---

# Research roadmap

## Phase 0 - Teacher baseline

Current phase.

- dynamic-choice API;
- LM Studio teacher adapter;
- normalized distributions;
- experience storage;
- outcome feedback;
- baseline metrics.

## Phase 1 - Dataset and evaluation harness

- export experiences to JSONL/Parquet;
- capture teacher soft distributions, not just hard labels;
- create domain-aware train/validation/test splits;
- create explicit OOD and unseen-choice tests;
- measure teacher consistency;
- measure probability calibration;
- benchmark latency and throughput.

## Phase 2 - First student

Train a small model on:

```text
(state, goal, arbitrary choices) -> choice distribution
```

rather than a fixed classifier.

Evaluate:

- top-1 agreement;
- KL divergence from teacher distributions;
- calibration;
- unseen-choice generalization;
- unseen-domain generalization;
- inference latency;
- memory footprint.

## Phase 3 - Confidence-gated routing

```text
request
   |
   v
student
   |
confident + safe?
  /          \
yes           no
 |             |
act         teacher
```

The routing policy should combine uncertainty, OOD detection, action risk, and reversibility.

## Phase 4 - Continuous distillation

- collect hard cases;
- incorporate outcomes and corrections;
- detect drift;
- retrain candidate students;
- recalibrate;
- evaluate against the currently deployed model;
- promote only when quality gates pass;
- preserve rollback capability.

## Phase 5 - Specialized students

Explore domain-specific students for:

- browser/computer use;
- coding/tool routing;
- operational automation;
- support/workflow routing.

## Phase 6 - Hierarchical controller

Allow decisions at multiple abstraction levels:

```text
goal -> strategy -> tactic -> tool -> action
```

with escalation to general reasoning at any level.

---

# Important failure modes

This project should be skeptical of its own confidence.

### Distribution drift

A student can become excellent at yesterday's world while silently degrading as workflows change.

### Teacher errors

Distillation can efficiently reproduce systematic teacher mistakes.

### Incorrect priors

Synthetic teacher data may have very different class/action frequencies from production.

### Calibration failure

High softmax confidence does not imply high empirical correctness.

### Dynamic-choice generalization

A student may perform well on familiar labels while failing on genuinely novel candidate sets.

### Compounding agent errors

A small per-step error rate can become a large task-level failure rate over long action chains.

### Outcome confounding

A successful outcome does not prove that a particular action caused the success.

### Catastrophic forgetting

Frequent refreshes may improve new domains while degrading old ones.

### Unsafe autonomous actions

Confidence alone must never override deterministic permissions, authorization boundaries, irreversible-action checks, or human confirmation policies.

---

# The broader idea

The most interesting outcome of this project would not be proving that a small model can classify things quickly.

It would be demonstrating an agent architecture where intelligence has layers:

```text
General model
    = novel reasoning / planning / synthesis

Learned decision models
    = routing / branching / control / evaluation

Deterministic runtime
    = safety / execution / invariants

Tools
    = effects on the world
```

Repeated intelligence becomes progressively cheaper because frequently traversed cognitive paths can be compiled into specialized inference.

The general model remains available for novelty instead of being invoked for every tiny decision.

That is the Jevize experiment.
