import { Octokit } from 'octokit';
import { 
    GITHUB_PERSONAL_TOKEN,
    GITHUB_REPO_CONFIG, 
    SHOULD_SKIP_PENDING_CHECKS,    
    SHOULD_SKIP_UPDATING_BRANCH, 
    PULL_REQUEST_CHECKS_TIMEOUT,
    PULL_REQUEST_REFETCH_LIMIT,
    PULL_REQUEST_CHECKS_LIMIT,
    PULL_REQUEST_REFETCH_TIMEOUT,
    SHOULD_SKIP_FAILING_CHECKS,
    checks_to_skip
} from './config';
import { IssueError, IssueErrorType } from '../models/error';
import logger from './logger';
import axios from 'axios';

class GitHub {
    private octokit;

    constructor() {
        this.octokit = new Octokit({ auth: GITHUB_PERSONAL_TOKEN });
    }

    async getCheckRuns(head_sha: string) {
        const res = await this.octokit.rest.checks.listForRef({
            ...GITHUB_REPO_CONFIG,
            ref: head_sha
        })

        return res.data.check_runs;
    }


    /**
     * Checks the current mergable state of the pull request and raises `IssueError` if the pull request is:
     * - Blocked either because it needs more votes or build has failed
     * - Has merge conflicts or is behind the base branch
     * - The pull request mergable state is unknown or unstable
     *
     * @param mergeable_state - The current state of the pull request
     * @returns {boolean} true if pull request has no invalid states
     */
    private checkStatus(mergeable_state: string) {
        if (mergeable_state === 'blocked') {
            throw new IssueError(IssueErrorType.NEEDS_APPROVAL);
        }
        // if PR is 'behind', we update the pull request instead of throwing error
        if (['dirty'].includes(mergeable_state)) {
            throw new IssueError(IssueErrorType.HAS_MERGE_CONFLICTS);
        }
        if (['unknown', 'unstable'].includes(mergeable_state)) {
            throw new IssueError(IssueErrorType.FAILED_CHECKS);
        }
        return true;
    }

    /**
     * Retrieves the Github pull request link from the Redmine description
     *
     * @param description - The Redmine description field which contains the pull request link
     * @returns {string} The pull request link retrieved from the Redmine description field
     */
    getGitHubPR(description: string) {
        const automated_match = /\[(https:\/\/github.com\/.*)\]/.exec(description);
        const match = /(https:\/\/github.com\/.*)/.exec(description);

        if (automated_match) {
            return automated_match[1];
        } else if (match) {
            return match[1];
        } else {
            return '';
        }
    }

    /**
     * Retrieves the pull request ID from a Github pull request link
     *
     * @param url - The Github pull request link
     * @returns {string} The pull request ID
     */
    getGitHubPRId(url: string) {
        const segments = url.split('/');
        const pull_index = segments.findIndex(s => s.toLocaleLowerCase() === 'pull');
        return segments[pull_index + 1];
    }

    async getBranch(branch_ref: string) {
        const branch = await this.octokit.rest.repos.getBranch({
            ...GITHUB_REPO_CONFIG,
            branch: branch_ref,
        });

        return branch;
    }

    async compareCommits(base_sha: string, head_sha: string) {
        const comparison = await this.octokit.rest.repos.compareCommits({
            ...GITHUB_REPO_CONFIG,
            base: base_sha,
            head: head_sha,
        });

        return comparison;
    }

    async isPullRequestBehindBase(pr_id: number) {
        const pr = await this.fetchPR(pr_id);
        const base_sha = pr.data.base.sha;
        const head_sha = pr.data.head.sha;

        const comparison = await this.compareCommits(base_sha, head_sha);

        return comparison.data.behind_by > 0;
    }

    async getPRStatuses(status_url: string): Promise<any> {
        const statuses = await axios.get(status_url, {
            headers: {
                Authorization: `Bearer ${GITHUB_PERSONAL_TOKEN}`,
            },
        });
        return statuses.data;
    }

    private verifyUnstablePR(check_runs: any[], statuses: any[], status_type: 'pending' | 'failure'): boolean {
        const shouldSkip = (name: string) => {
            return checks_to_skip.some(check_regexp => {
                const is_regex = new RegExp(/\/(.+)\/(.*)/).exec(check_regexp)
                let match = new RegExp(check_regexp);
                if (is_regex) {
                  match = new RegExp(is_regex[1], is_regex[2])
                }
                return match.test(name);
            });
        }

        const runs = check_runs.filter(check_run => {
            return !shouldSkip(check_run.name) && (status_type === 'pending' ? check_run.status === 'in_progress' : check_run.status === 'completed'  && check_run.conclusion === 'failure')
        })

        if (runs.length) return true

        /**
         * For a pull request's statuses, Github returns a history of all statuses
         * So we want to only check the most recent status's state for each type of status
         * 
         * The checked_status is to ensure that we only check each status's type for the most recent one once only
         */
        let checked_statuses = new Set()
        for (let i = 0; i < statuses.length; i++) {
            const status: { context: string; state: string } = statuses[i];

            if (shouldSkip(status.context)) continue
            if (!checked_statuses.has(status.context)) {
                checked_statuses.add(status.context);

                if (status.state === status_type) {
                    return true
                }
            }
        }

        return false;
    }

    /**
     * Makes a GET request to fetch the Github pull request
     *
     * @param pr_id - The pull request ID
     * @returns {string} The pull request object returned from Octokit
     */
    async fetchPR(pr_id: number) {
        const pr_details = await this.octokit.rest.pulls.get({ ...GITHUB_REPO_CONFIG, pull_number: pr_id });
        return pr_details;
    }

    /**
     * Merges a pull request if it mergable according to its mergable state.
     *
     * @async
     * @param pr_id - The pull request ID to be merged
     * @param task_id - (For Clickup) The task ID of the Clickup card
     */
    async mergePR(pr_id: number, task_id?: string) {
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        /**
         * 1. Fetch PR
         * 2. If PR status is unknown, refetch PR
         * 3. If PR is behind, update PR with base branch
         * 4. Check PR status again for conflicts or failed builds
         * 5. Squash and merge PR
         */
        let pr_to_merge = await this.fetchPR(pr_id);
        if (pr_to_merge) {
            let refetch_counter = 0;
            let checks_counter = 0;
            let skipped = false;
            while (['unknown', 'behind', 'unstable'].includes(pr_to_merge.data.mergeable_state)) {
                // TODO: handle this later, when branch is still behind or unknown after refetches
                if (refetch_counter === PULL_REQUEST_REFETCH_LIMIT || checks_counter === PULL_REQUEST_CHECKS_LIMIT) break;
                if (pr_to_merge.data.mergeable_state === 'unknown') {
                    if (pr_to_merge.data.merged) {
                        logger.log('Pull request has already been merged.');
                        throw new IssueError(IssueErrorType.ALREADY_MERGED);
                    }
                    // If the mergable state is unknown, we need to refetch it once more
                    // https://stackoverflow.com/questions/30619549/why-does-github-api-return-an-unknown-mergeable-state-in-a-pull-request
                    logger.info(
                        'Mergeable state of pull request is currently unknown, attempting to refetch pull request...'
                    );
                    
                    await sleep(PULL_REQUEST_REFETCH_TIMEOUT);
                    refetch_counter += 1;
                } else if (pr_to_merge.data.mergeable_state === 'behind') {
                    if (SHOULD_SKIP_UPDATING_BRANCH && pr_to_merge.data.mergeable) {
                        skipped = true;
                        break;
                    }
                    logger.log('Pull request branch is behind, updating branch with base branch...');
                    this.updatePRWithBase(pr_id);
                    logger.log(
                        'The pull request has incomplete checks. Waiting for the checks to be completed in the pull request...'
                    );

                    await sleep(PULL_REQUEST_CHECKS_TIMEOUT);
                    checks_counter += 1
                } else if (pr_to_merge.data.mergeable_state === 'unstable') {
                    /**
                     * When a pull request state is unstable, it could mean these things:
                     * 1. The pull request has not completed the checks (pr_status.state is 'pending' or check run.status is 'in_progress')
                     * 2. One of the checks has failed (pr_status.state is 'failure' or check_run.conclusion is 'failure')
                     * 
                     * We have to verify from 2 sources (check runs and pr statuses) since some integrations like GitGuardian for instance,
                     * does not show up within the pr statuses and only within the check runs
                     */

                    const check_runs = await this.getCheckRuns(pr_to_merge.data.head.sha)
                    const pr_statuses = await this.getPRStatuses(pr_to_merge.data.statuses_url)

                    const has_pending_status = this.verifyUnstablePR(check_runs, pr_statuses, 'pending')
                    const has_failing_status = this.verifyUnstablePR(check_runs, pr_statuses, 'failure')

                    if (has_pending_status) {
                        if (SHOULD_SKIP_PENDING_CHECKS) {
                            logger.log('Skipping pull request checks based on settings...');
                            skipped = true;
                            break
                        } else {
                            logger.log(
                                `The pull request has incomplete checks. Waiting for the checks to be completed in the pull request...`
                            );
                            await sleep(PULL_REQUEST_CHECKS_TIMEOUT);
                            checks_counter += 1
                        }
                    } else if (has_failing_status) {
                        if (SHOULD_SKIP_FAILING_CHECKS) {
                            logger.log(
                                'There are failing checks, but skipping these checks it due to settings SKIP_FAILING_CHECKS=true...',
                                'warning'
                            );
                            skipped = true;
                            break;
                        }
                        throw new IssueError(IssueErrorType.FAILED_CHECKS);
                    } else {
                        skipped = true
                        break
                    }
                }
                
                pr_to_merge = await this.fetchPR(pr_id);
            }

            // if we have checked that the PR does not have failed checks, and option to skip checks SHOULD_SKIP_PENDING_CHECKS is true, then do not re-check PR
            // otherwise checkStatus will raise error since status is still unstable
            if (!skipped) this.checkStatus(pr_to_merge.data.mergeable_state);
            await this.octokit.rest.pulls.merge({ ...GITHUB_REPO_CONFIG, pull_number: pr_id, merge_method: 'squash' });
            await this.octokit.rest.issues.createComment({
                ...GITHUB_REPO_CONFIG,
                issue_number: pr_id,
                body: `✨ PR has been merged by Paimon the Release Bot`,
            });
        }
    }

    async updatePRWithBase(pr_id: number) {
        logger.log('Updating pull request with base branch...');
        await this.octokit.rest.pulls.updateBranch({
            ...GITHUB_REPO_CONFIG,
            pull_number: pr_id,
        });
        await this.octokit.rest.issues.createComment({
            ...GITHUB_REPO_CONFIG,
            issue_number: pr_id,
            body: '👌 Pull request has been updated with the base branch by Paimon the Release Bot',
        });
    }
}

export default new GitHub();
