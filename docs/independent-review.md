<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Supportive independent review

Review helps a change move forward with evidence and useful improvements. An
independent reviewer (person or agent other than the implementer) checks the code
and tries the delivered product. This does not add a routine human approval gate;
honor repository requirements and explicit merge holds. Scale the work to the
change's behavior and risk, not a fixed number of experiments or approvals. This
guide describes how to perform independent review within the project's existing
workflow; it does not require a new approval stage for every consuming repository.

## A small review loop

1. Read the purpose, diff, relevant repository guidance, and available test results.
   Look for weaknesses in correctness, security, error handling, and maintainability.
   A behavior change without tests, or edits spread across more files than the
   purpose seems to need, is a reason to investigate and ask for an explanation,
   not automatic rejection. Check whether existing tests cover the behavior and
   whether the spread follows the architecture before proposing more work.
2. In a second, fresh environment separate from the implementer's working setup,
   download and install the candidate using the documented user path. Identify
   the exact revision and artifact; use a clean container or equivalent with no
   dependency on the author's checkout or uncommitted state. If no candidate
   artifact is published, build from the exact revision and install that artifact,
   explicitly noting that download/distribution remains unverified. A source-only
   test run does not establish that installation or the shipped product works.
3. Use the changed features and nearby behavior they could affect: a realistic
   successful use, relevant invalid input or failure paths, and adjacent commands
   or flows. Use the feature scenarios as a starting point, then investigate what
   happens. Continuous integration handles ordinary regression; reviewers do not
   manually repeat the full suite on every PR. Broaden exploration when evidence
   reveals a risk. For documentation-only changes, exercise the changed guidance,
   examples, links, or generated artifact instead of inventing an application test.
4. Post one PR comment per meaningful experiment using the template below. Keep
   results independently readable, including failures and blocked attempts. The
   author fixes relevant findings; the reviewer reruns affected experiments on the
   new revision and links the earlier evidence. Close with a short review decision
   linking results, unresolved findings, and limits.

Label findings **blocking** when a demonstrated correctness, security, or data-loss
problem makes the change unsafe or incorrect to ship. Explain the reproduction,
impact, and smallest useful fix. Label suggestions and polish **nonblocking**;
offer them constructively and defer unrelated improvements. An unavailable
environment is a verification gap, not proof of a product defect or a pass. State
whether the missing evidence prevents a decision and what would resolve it.

## Review evidence comment template

Copy this for each experiment. Sanitize inputs and output before posting: remove
credentials, personal data, and sensitive paths while retaining useful evidence.
Link large sanitized artifacts and identify omitted output; do not dump the
environment. Keep the purpose and outcome visible outside the collapsed output.

````markdown
### Experiment: <short name>

- Purpose: <behavior/risk; feature/scenario reference when applicable>
- Revision/artifact: <full commit; artifact URL and digest or immutable identity>
- Environment: <fresh environment identity, OS/runtime/tool versions, setup path>
- Command/inputs: <exact install and execution commands; sanitized input/fixture>
- Expected: <observable result, including exit status where relevant>
- Actual: <observed result and exit status; evidence link if needed>
- Result: <PASS / FAIL / BLOCKED; reason and unverified limits>
- Finding: <blocking / nonblocking / none; impact and next action>

<details>
<summary>Sanitized output</summary>

```text
<relevant output, including failures; identify any omissions>
```

</details>
````

## Verification of user-run paths

A pull request that changes something users run, such as a quickstart, install
documentation, or a release, needs a verification comment from Vera before merge.
Vera follows the changed path as a user would and reports each check as passed,
failed, blocked, or not run, tied to the full commit SHA it tested. A later commit
needs a new comment or an explicit assessment that earlier results still apply.

Vera also runs a weekly drift check of those user-run paths, following each
quickstart and install document against the current releases, and reports the
results. Report a failure or blocked step in the affected repository.

## Definition of done

- The author identifies the candidate, changed behavior, automated results, and
  known limits. Applicable [test publication and scenario coverage](developer-interface.md#definition-of-done)
  and [generated documentation](tool-usability.md) evidence is linked from the PR.
- An independent reviewer has inspected the code and exercised installation,
  changed features, and relevant adjacent behavior in a fresh environment, with
  separate experiment comments. Evidence identifies the tested revision; later
  changes have an explicit assessment and affected experiments are rerun.
- Blocking findings are resolved and verified. Nonblocking suggestions and any
  remaining coverage/environment gaps have a clear disposition; unrun or blocked
  checks are never reported as passes. A material verification gap stays open.
- For a change to something users run, Vera's verification comment covers the
  merge candidate's commit SHA.
- The review decision links the evidence and explains why the change can proceed
  or what remains blocked. Existing merge/release rules still apply.

Start by practicing this loop on the top-level Living Proof tool in a separate
product PR. This guide defines the process; it does not claim that product has
been installed, reviewed, or given scenario coverage by this documentation change.
