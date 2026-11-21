// SPDX-License-Identifier: Apache-2.0

// semantic-release calls verifyRelease before creating a tag or calling publish.
export function verifyRelease(plan, { nextRelease }) {
  if (nextRelease.gitHead !== plan.commit || nextRelease.version !== plan.version ||
      nextRelease.gitTag !== plan.gitTag) {
    throw new Error('Release engine disagrees with the verified candidate version or commit');
  }
}
