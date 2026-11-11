<!-- SPDX-License-Identifier: CC-BY-4.0 -->
<!-- markdownlint-configure-file { "MD013": { "tables": false } } -->

# Bot GitHub Apps

This is the organization owner's procedure for registering one private GitHub
App each for Rivet, Cody, and Vera, then storing the App id and private key
on that bot's secret card in Grok Bot. Keel has no manifest in this set yet.

The manifests, `scripts/app-token`, and `task github:app-token:help` were
checked at
[Living-Proof-Labs/.github](https://github.com/Living-Proof-Labs/.github)
commit `c44c29d98a22ca8f7a69f972bcce4f5f20e0ea5f`
([pull request 49](https://github.com/Living-Proof-Labs/.github/pull/49)).
Check out that commit. After the pull request merges, use the `main` revision
that contains the same files. The form, callback, and exchange helpers are
also on `main` at `a6b6a5add856640b0f42a7a5811059e20c808421`; the bot manifests
and `scripts/app-token` are the pull-request additions.

The settings-audit credential stays separate. It uses
`REPO_ADMIN_APP_CLIENT_ID` and `REPO_ADMIN_APP_PRIVATE_KEY` on the
`repository-audit` and `repository-administration` environments, and it uses
the client id. The steps below do not register
`repository-settings-audit.manifest.json` or
`repository-settings-apply.manifest.json`.

Rivet's App is the one that mints `GH_TOKEN` for
[`scripts/apply-repo-policy`](SETTINGS.md#apply-the-pinned-policy).

## Checkout

From the `.github` checkout above, install the pinned Node and Task.
`task setup` runs `bash tools/setup.sh`. When the `task` command is not
installed, run `bash tools/setup.sh` directly. That script installs Node and
Task under `.tools` and does not need `sudo`. Repository tasks then go through
`bash tools/task.sh`, which is the pinned Task even when a `task` command is
absent from `PATH`.

```sh
bash tools/setup.sh
bash tools/task.sh github:apps:check
```

`github:apps:check` reads the manifests on disk and does not contact GitHub.
It prints `GitHub App manifests are valid.` when they match the checked-in
permission sets.

## Permissions

These tables are the `default_permissions` objects in the three manifests.
Each manifest sets `public` to false, `default_events` to `[]`, and no
webhook. GitHub still adds Metadata read for an App; the manifests request it
explicitly.

### Rivet

Manifest:
[`config/github/apps/rivet.manifest.json`](https://github.com/Living-Proof-Labs/.github/blob/c44c29d98a22ca8f7a69f972bcce4f5f20e0ea5f/config/github/apps/rivet.manifest.json).
Name: `Living Proof Labs Rivet` (23 characters).

| Permission | Access |
| --- | --- |
| actions | write |
| administration | write |
| checks | read |
| contents | write |
| issues | write |
| metadata | read |
| pages | write |
| pull_requests | write |

### Cody

Manifest:
[`config/github/apps/cody.manifest.json`](https://github.com/Living-Proof-Labs/.github/blob/c44c29d98a22ca8f7a69f972bcce4f5f20e0ea5f/config/github/apps/cody.manifest.json).
Name: `Living Proof Labs Cody` (22 characters).

| Permission | Access |
| --- | --- |
| actions | read |
| checks | read |
| contents | write |
| issues | write |
| metadata | read |
| pull_requests | write |
| workflows | write |

### Vera

Manifest:
[`config/github/apps/vera.manifest.json`](https://github.com/Living-Proof-Labs/.github/blob/c44c29d98a22ca8f7a69f972bcce4f5f20e0ea5f/config/github/apps/vera.manifest.json).
Name: `Living Proof Labs Vera` (22 characters).

| Permission | Access |
| --- | --- |
| actions | read |
| checks | read |
| contents | read |
| issues | write |
| metadata | read |
| pull_requests | write |

GitHub App names are unique across GitHub and are limited to 34 characters.
The three names above are inside that limit. Keep the manifest name on the
confirmation page. If GitHub reports that a name is already taken, stop and
change the manifest in the repository before trying again.

## Create each App

Finish one bot before starting the next. The callback listens only on
`127.0.0.1:8787`.

The commands below use Rivet. For Cody or Vera, change the manifest path and
use a different directory. Write every output file outside the git checkout.
The tools create those files mode `0600` and refuse to overwrite them.

### 1. Render the local form

`task github:apps:form:help` prints the render command. In this checkout the
same task is `bash tools/task.sh github:apps:form:help`. The printed usage is:

<!-- markdownlint-disable MD013 -->

```text
Usage: node tools/github/render-app-manifest-form.mjs --manifest FILE --output FILE --state-output FILE [--organization OWNER]
```

<!-- markdownlint-enable MD013 -->

The Taskfile runs that program through `bash tools/with-node.sh`, which finds
the Node installed by `bash tools/setup.sh`. Render Rivet's manifest for the
Living-Proof-Labs organization:

```sh
dir="${HOME}/lpl-bot-apps/rivet"
mkdir -p "$dir"
bash tools/with-node.sh node tools/github/render-app-manifest-form.mjs \
  --manifest config/github/apps/rivet.manifest.json \
  --output "${dir}/form.html" \
  --state-output "${dir}/state" \
  --organization Living-Proof-Labs
```

Cody's manifest is `config/github/apps/cody.manifest.json`. Vera's manifest is
`config/github/apps/vera.manifest.json`.

The form posts to
`https://github.com/organizations/Living-Proof-Labs/settings/apps/new`.
Open `form.html` only after the callback receiver in the next step is
listening. On GitHub's confirmation page, review the manifest: the name is
`Living Proof Labs Rivet`, `Living Proof Labs Cody`, or
`Living Proof Labs Vera`; webhooks are off (`default_events` is empty and the
manifest sets no webhook). Then submit the form.

### 2. Receive the callback and exchange the code

`task github:apps:callback:help` prints:

<!-- markdownlint-disable MD013 -->

```text
Usage: node tools/github/receive-app-manifest-code.mjs --output FILE --state-file FILE
```

<!-- markdownlint-enable MD013 -->

Start the receiver in this checkout before submitting the form. It accepts
only the state written by the render step, and it does not print the one-time
code:

```sh
bash tools/with-node.sh node tools/github/receive-app-manifest-code.mjs \
  --output "${dir}/code" \
  --state-file "${dir}/state"
```

It waits on `http://127.0.0.1:8787`. Submit the form in a browser on this
same machine. GitHub redirects to
`http://127.0.0.1:8787/github-app-manifest/callback`. The receiver then prints
`Saved one-time manifest code to ...`.

GitHub's manifest code is valid for one hour. Finish this callback and the
exchange below inside that hour.

`task github:apps:exchange:help` prints:

<!-- markdownlint-disable MD013 -->

```text
Usage: node tools/github/exchange-app-manifest-code.mjs --code-file FILE --output FILE --execute
```

<!-- markdownlint-enable MD013 -->

A run without `--execute` does not contact GitHub and does not write the
response. The exchange reads a GitHub credential by running `gh auth token`.
Authenticate the GitHub CLI as the organization owner, then exchange the code:

```sh
bash tools/with-node.sh node tools/github/exchange-app-manifest-code.mjs \
  --code-file "${dir}/code" \
  --output "${dir}/registration" \
  --execute
```

On success the tool prints that the response file contains secrets and must
not be committed or printed. The JSON includes the numeric App `id`, the first
PEM (`pem`), and a webhook secret (`webhook_secret`), plus the other
registration fields GitHub returns. Webhooks are off, so the webhook secret is
unused. Leave the webhook secret and the client secret out of the secret
card.

Read `id` and `pem` from the file without printing it into the shell, a pull
request, or a chat. Shell history must not gain the PEM, the webhook secret,
or the one-time code. Delete `${dir}` after the secret card below has both
values. Never post a key anywhere.

## Install the App

Install each App only on the Living-Proof-Labs organization. Choose
repositories deliberately: on the installation page, select Living-Proof-Labs
and then select repositories one by one.

Rivet's installation has to include every repository
`scripts/apply-repo-policy` manages, including `.github`. The command lists
`GET /orgs/Living-Proof-Labs/repos?type=all`. It does not limit that list to
the inventory file. An installation token returns only repositories the
installation includes, so a repository left out is absent from the run, and
an empty list fails. Select every repository that list should include. The
registered names, including `.github`, are in
[`config/github/repositories.json`](https://github.com/Living-Proof-Labs/.github/blob/c44c29d98a22ca8f7a69f972bcce4f5f20e0ea5f/config/github/repositories.json).

Limit Cody's installation to the repositories Cody works in. Limit Vera's
installation to the repositories Vera works in.

The installation id is optional. When
`<BOT>_GITHUB_APP_INSTALLATION_ID` is unset, `scripts/app-token` looks up
`GET /orgs/Living-Proof-Labs/installation`. Set the variable only when you
want to skip that lookup. The value is the numeric installation id, digits
only.

## Private key

The first PEM is the `pem` field in the exchange response. GitHub returns that
key once. Later keys come from the App's settings page: choose **Generate a
private key**. GitHub downloads that PEM once as well.

The key is an RSA PKCS#1 PEM. The block begins with
`-----BEGIN RSA PRIVATE KEY-----`. `scripts/app-token` wants that PEM text in
the environment variable. A file path is rejected. A value that stores line
breaks as the two characters `\n` is accepted, and one pair of surrounding
quotes is stripped.

## Secret card

On the bot's own secret card in Grok Bot, set the numeric App id, the PEM
text, and, optionally, the installation id:

| Bot | App id | Private key | Installation id (optional) |
| --- | --- | --- | --- |
| rivet | `RIVET_GITHUB_APP_ID` | `RIVET_GITHUB_APP_PRIVATE_KEY` | `RIVET_GITHUB_APP_INSTALLATION_ID` |
| cody | `CODY_GITHUB_APP_ID` | `CODY_GITHUB_APP_PRIVATE_KEY` | `CODY_GITHUB_APP_INSTALLATION_ID` |
| vera | `VERA_GITHUB_APP_ID` | `VERA_GITHUB_APP_PRIVATE_KEY` | `VERA_GITHUB_APP_INSTALLATION_ID` |

`<BOT>_GITHUB_APP_ID` is the numeric App `id` from the exchange response. The
client id is a different field; this variable takes the numeric id.
`<BOT>_GITHUB_APP_PRIVATE_KEY` is the PEM text.

Rivet's card is what mints `GH_TOKEN` for `scripts/apply-repo-policy`. Leave
`REPO_ADMIN_APP_CLIENT_ID` and `REPO_ADMIN_APP_PRIVATE_KEY` on the
settings-audit credential.

`task github:app-token:help` prints the same usage text as
`scripts/app-token`. The token is the only text on standard output. Errors go
to standard error and omit the key, the signed JSON Web Token, and the
installation token.

## First run

Before any `--apply`, mint Rivet's installation token and preview the policy:

```sh
GH_TOKEN=$(scripts/app-token rivet) scripts/apply-repo-policy --dry-run
```

Export the Rivet secret-card variables into that shell first. The command
substitution places the token in `GH_TOKEN` for the policy process. Do not
paste the token into git, a pull request, or a chat. The dry-run prints
differences and performs no writes. Continue to `--apply` only after that
preview is the change you expect.
[Apply the pinned policy](SETTINGS.md#apply-the-pinned-policy) records the
exit codes.

## Rotate a key

1. On the App's settings page, choose **Generate a private key** and download
   the new PEM. The previous key still signs until you delete it.
2. Update `<BOT>_GITHUB_APP_PRIVATE_KEY` on that bot's secret card with the
   new PEM text.
3. Export the updated variables and confirm the helper prints a token.
   Use `cody` or `vera` instead of `rivet` for that bot:

   ```sh
   scripts/app-token rivet
   ```

   Standard output is the installation token. Do not paste it into git, a
   pull request, or a chat.
4. Delete the old key on the App's settings page. Never post a key anywhere.

## Revoke access

Deleting a private key stops new JSON Web Tokens signed with that key.
Installation tokens already issued keep working until they expire, which is
about an hour, or until the installation is suspended or uninstalled.
Suspending or uninstalling the App on Living-Proof-Labs cuts off those
installation tokens.

To retire a bot, delete the App and clear that bot's secret card. Never post
a key anywhere.
