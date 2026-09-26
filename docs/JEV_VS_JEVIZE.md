# Jev vs Jevize: the hard parts

> **What do we give up by distilling a general teacher into small students, compared with a system such as Jev that is designed to answer arbitrary decision questions directly?**

Jevize has potential advantages in ownership, specialization, privacy, cost, and continual learning, but accepts a major research burden: **we must prove that a distilled student understands genuinely new decision problems rather than merely recognizing patterns similar to its training data.**

Jev is closed source. References below describe its public behavior/design goals and claims, not assumptions about its private architecture or training recipe.

| Capability | Jevize distilled student | Jev |
| --- | --- | --- |
| Very cheap inference | **Yes** | **Yes** |
| Very fast | **Yes** | **Yes** |
| Local/self-hosted | **Yes** | No |
| Learns your environment | **Excellent potential** | Unknown |
| Arbitrary new classes | Possible, but harder | **Core feature** |
| Arbitrary new questions | Possible, but harder | **Core feature** |
| Generalization outside training distribution | **Main concern** | Claimed strength |
| Calibrated probabilities | Requires explicit work | **Core design goal** |
| Continuously improve from outcomes | **Huge potential advantage** | Not under our control |
| Architecture/weights available | **Yes** | No |

The rows that matter most are not speed or cost. The real battle is **dynamic generalization + calibration**.

## 1. A universal API is not automatically a universal model

Jevize can accept `decide(state, goal, choices)` with arbitrary choices. That is easy at the software layer. It does not prove the student learned the meta-task.

If training contains `refund | fraud | support`, then tomorrow we ask `rollback | inspect_logs | restart | inspect_database`, there are three levels of success:

```text
Level 1: memorized classes
Level 2: learned domain patterns
Level 3: learned the meta-task: reason over state + objective + completely new actions
```

Jevize needs Level 3 to reproduce the most interesting Jev-like property. This is probably the project's largest technical risk.

## 2. Distillation is lossy compression

A large teacher contains far more semantic structure and world knowledge than a tiny student can necessarily preserve. If our corpus is mostly browser automation, the student may become excellent at browser decisions while losing the teacher's ability to reason about an unfamiliar database incident.

So the realistic goal is not initially "replace the teacher universally." It is:

> **Compile frequently used regions of the teacher's decision behavior while preserving escalation for everything else.**

The student does not need to know everything. It must know **when it knows enough to act**.

## 3. Confident generalization failure is the dangerous failure

`I don't know -> escalate` is healthy. `rollback production: 0.98` on a problem outside the student's competence is dangerous.

We therefore have two research problems:

```text
Can the student make the decision?
AND
Can it recognize when it should not make the decision?
```

Routing eventually needs more than max softmax confidence: entropy, top-choice margin, ensemble disagreement, OOD distance, domain familiarity, candidate novelty, historical calibration, action risk, and reversibility may all matter.

## 4. Arbitrary classes are harder than they look

A student repeatedly trained on `click | scroll | wait | type` may not understand tomorrow's `inspect_network | switch_workspace | request_permission`.

This suggests the first useful student should retain a pretrained semantic backbone and encode choices by meaning rather than use a permanent fixed classification head.

Conceptually:

```text
                 STATE + GOAL
                      |
                semantic encoder
                      |
               context representation
                    / | \
                   v  v  v
                choice encoders
                   \  |  /
                    scores
                      |
                    softmax
```

A choice must be represented by its semantics, not by permanent output neuron #17.

## 5. Arbitrary questions are even harder

These questions can legitimately produce different answers from the same state and choices:

```text
Which action best advances the goal?
Which action is safest?
Which action is most reversible?
Which component most likely caused the failure?
Has the task completed?
```

A student trained mainly on `best next action` may silently ignore a novel question. We therefore need counterfactual evaluation where **state and choices remain constant while the question changes and the correct distribution changes**.

## 6. Teacher-generated data can create a synthetic bubble

One million examples generated from a narrow template family are not necessarily one million diverse reasoning problems. Random train/test splitting can hide this.

Jevize should combine:

```text
synthetic teacher scenarios
+ real decisions
+ hard/adversarial examples
+ human-created evaluation sets
+ actual tool outcomes
```

OOD evaluation should use genuinely different domains and unseen choice/question structures.

## 7. Distillation inherits teacher mistakes

Ordinary distillation can turn a teacher's systematic mistake into a cheap, fast systematic mistake.

This is why Jevize must eventually distinguish **teacher targets** from **outcome targets**. If the teacher prefers `restart_service` but actual experience shows `inspect_database` produces better outcomes in this environment, Jevize should eventually learn from reality rather than eternally imitate the teacher.

This is one of Jevize's largest potential advantages.

## 8. Daily refresh helps adaptation, not instant generality

Continuous or daily distillation is absolutely worth testing, especially when local training is cheap. But frequent retraining solves **adaptation**, not necessarily **general intelligence**.

The intended cycle is:

```text
novel situation
      |
student uncertainty/OOD
      |
    teacher
      |
successful experience
      |
 training set
      |
 next student
      |
future occurrence becomes cheap
```

The desired property is therefore not "the student always knows." It is:

> **The student handles learned territory cheaply, detects its boundary, and turns useful teacher escalations into future learned territory.**

## 9. Frequent retraining risks catastrophic forgetting

A new student may improve coding while silently getting worse at browser automation. Every candidate therefore needs permanent regression suites across previous competencies, unseen-choice tests, unseen-question tests, OOD detection, and calibration.

Continual learning without continual evaluation is unsafe.

## 10. Calibration is first-class

A model emitting `0.90` is not necessarily correct 90% of the time. But Jevize wants uncertainty to control computation, so poor calibration breaks the architecture.

We should measure ECE, Brier score, negative log likelihood, reliability curves, calibration by domain/risk, and calibration under distribution shift. Techniques may include temperature scaling, isotonic calibration, ensembles, conformal methods, and explicit OOD models.

Calibration ultimately needs to be checked against real correctness/outcomes, not merely teacher agreement.

## 11. Teacher agreement is not correctness

We must distinguish:

```text
student <-> teacher agreement
student <-> human/reference correctness
student <-> actual outcome success
teacher <-> actual outcome success
```

The exciting long-term result would be `student outcome success > teacher outcome success` on a specialized local domain. Then Jevize has moved beyond compression into **environment-specific learned expertise**.

## 12. Student size is an empirical optimization

Small models may collapse subtle distinctions between choices such as `retry_payment`, `retry_payment_with_new_token`, and `request_new_payment_method`.

The objective is not the smallest model. It is:

> **The smallest model that preserves the required decision frontier.**

A 3B student displacing 95% of 30B teacher calls may be far more useful than a 150M student that displaces 40% and fails under novelty.

## 13. Long chains amplify small errors

Even 98% per-step accuracy can be problematic over long dependent workflows: `0.98^50` is about 36%. Real errors are not independent, but the point stands.

Computer-use/tool agents therefore need step accuracy **and** end-to-end task completion **and** recovery rate. The runtime should verify progress and escalate when observed state diverges from expectation.

## 14. Action costs differ

Choosing the wrong browser tab and deleting a production database are not equivalent. Execution should eventually require:

```text
sufficient confidence
AND acceptable OOD risk
AND acceptable action risk
AND authorization
AND confirmation policy
```

The neural decision layer must never become the authorization layer.

## 15. Where Jevize may have the advantage

A general decision service must work broadly. Jevize can become deeply specialized to one environment: repositories, deployment patterns, tools, recurring failures, organization terminology, historical outcomes, human corrections, and local safety rules.

The tradeoff is roughly:

```text
Jev-like general service
------------------------
strong immediate generality
little local training burden
closed implementation
limited ownership of adaptation

Jevize
------
weaker initial student
significant evaluation burden
local/private
learns from actual environment
can specialize beyond teacher behavior
can continuously improve
full control over routing and safety
```

## 16. Jevize does not need to beat Jev everywhere

A useful architecture can be:

```text
                   request
                      |
                   student
                      |
              safe + familiar?
                 /          \
               yes           no
                |             |
              cheap       teacher/Jev/
             decision     frontier model
```

If a student handles 90% of routine decisions at tiny cost while a general model handles the difficult 10%, the architecture may already be valuable. Hence the central metric: **teacher displacement at constant quality**.

## 17. What would falsify Jevize?

The thesis weakens substantially if useful dynamic-choice generalization requires students almost as large as teachers; OOD detection is too unreliable; calibration collapses under realistic drift; continual training causes persistent regressions; teacher calls remain necessary for most tasks; chain errors become unacceptable; training/evaluation costs exceed inference savings; specialization does not improve outcomes; or general models become so cheap and fast that this complexity is not worthwhile.

Those are research results, not failures to hide.

## 18. What would strong success look like?

Illustrative, not promised targets:

```text
Teacher: local 30B
Student: 1B
Routine decision coverage:        92%
Teacher escalation:                8%
Task success vs teacher baseline: -0.3%
Median decision latency:          -85%
Compute per decision:             -90%
Novel-domain escalation recall:   98%

After outcome learning:
local-domain task success:        +4% over teacher
```

The important shape is dramatically cheaper inference, nearly unchanged quality, reliable novelty escalation, measurable adaptation from outcomes, and eventually better specialized performance.

# The key mental model

### Jev's attractive promise

```text
Ask me a new decision question
with a new set of choices
and I can answer it cheaply right now.
```

### Jevize's proposed promise

```text
My general teacher handles novelty.

I learn which reasoning recurs in YOUR environment,
compile it into cheaper students,
and send unfamiliar cases back to the teacher.

Useful escalations become training data,
so expensive reasoning can become cheap reasoning over time.
```

Jevize accepts more complexity and evaluation responsibility in exchange for **ownership, privacy, specialization, continual learning, and the possibility of converting real experience into increasingly cheap local intelligence**.

The central technical question is:

> **Can we preserve enough dynamic semantic reasoning, reliably detect when we have left the student's learned territory, and continuously expand that territory without degrading existing capabilities?**

That is the experiment.
