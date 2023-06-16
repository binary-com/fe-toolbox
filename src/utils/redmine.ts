import axios from "axios";
import { REDMINE_API_TOKEN } from "./config";
import { REDMINE_API_URL } from "../models/constants";
import github from "./github";
import {
  ASSIGNEE,
  Issue as RedmineIssue,
  PRIORITY,
  PROJECT,
  STATUS,
  TRACKER,
  UpdateIssueParams,
  User,
  Version,
} from "models/redmine";
import { IssueError, IssueErrorType } from "../models/error";
import { createSpinner } from "nanospinner";
import cheerio from "cheerio";
import circleci from "./circleci";
import { CIRCLECI_BRANCH, CIRCLECI_WORKFLOW_NAME } from "models/constants";
import { event_manager } from "utils/manager";
import logger from "./logger";
import {
  Assignee,
  Issue,
  IssueId,
  IssueQueue,
  ReleaseStrategy,
} from "models/strategy";

//
const MERGE_DELAY = 1 * 60 * 1000;

class Redmine implements ReleaseStrategy {
  issues_queue: IssueQueue;
  private released_cards: IssueQueue;
  private failed_issues: IssueError[];
  private spinner;

  constructor() {
    this.issues_queue = new IssueQueue();
    this.released_cards = new IssueQueue();
    this.failed_issues = [];
    this.spinner = createSpinner();
  }

  fetchIssues(...args: any[]): Promise<Issue[]> {
    throw new Error("Method not implemented.");
  }

  getAllIssues(): Issue[] {
    return this.issues_queue.issues;
  }

  getAllFailedIssues(): IssueError[] {
    return this.failed_issues;
  }

  getFailedCards(): IssueError[] {
    return this.failed_issues;
  }

  hasIssue(id: IssueId): boolean {
    return this.issues_queue.hasIssue(id);
  }

  getIssueId(issue_link: string): IssueId | null {
    const groups = /https:\/\/redmine\.deriv\.cloud\/issues\/([0-9]+)/.exec(
      issue_link
    );
    if (groups) {
      return groups[groups.length - 1];
    }
    return null;
  }

  async fetchUser(user_id: number): Promise<Assignee> {
    // CLEANUP: if user is not found it returns error 404 not found
    const response = await axios.get(
      `${REDMINE_API_URL}/users/${user_id}.json` || "",
      {
        headers: {
          "X-Redmine-API-Key": REDMINE_API_TOKEN,
        },
      }
    );

    const user = response.data.user as User;
    return {
      id: user.id,
      name: `${user.firstname} ${user.lastname}`,
      email: user.mail || "",
    };
  }

  /**
   * Fetches an issue from Redmine.
   *
   * @param {IssueId} id - The issue ID to be fetched
   * @returns {Issue} - The fetched issue
   */
  async fetchIssue(id: IssueId): Promise<Issue> {
    const req = axios.get(`${REDMINE_API_URL}/issues/${id}.json` || "", {
      headers: {
        "X-Redmine-API-Key": REDMINE_API_TOKEN,
      },
    });

    const req_html = axios.get(`${REDMINE_API_URL}/issues/${id}` || "", {
      headers: {
        "X-Redmine-API-Key": REDMINE_API_TOKEN,
      },
    });

    // stop fetching if you encountered an error
    const responses = await Promise.all([req, req_html]).catch((err) => {
      throw new Error(`Unable to fetch issue: ${err}`);
    });

    const issue = responses[0].data.issue as RedmineIssue;

    return {
      id: String(issue.id),
      title: issue.subject,
      description: issue.description,
      status: issue.status.name,
      tags: this.parseIssueTags(responses[1].data),
      assignees: [
        {
          id: issue.assigned_to.id,
          name: issue.assigned_to.name,
          email: "",
        },
      ],
      pull_request: github.getGitHubPR(issue.description),
    };
  }

  /**
   * Updates an issue in Redmine.
   *
   * @param {IssueId} id - The ID of the issue to be updated
   * @param {Partial<UpdateIssueParams>} details - The issue details to be updated, such as its status, assignee, description, etc
   */
  async updateIssue(id: IssueId, details: Partial<UpdateIssueParams>) {
    const response = await axios.put(
      `${REDMINE_API_URL}/issues/${id}.json`,
      {
        issue: details,
      },
      {
        headers: {
          "X-Redmine-API-Key": REDMINE_API_TOKEN,
        },
      }
    );
    return response;
  }

  /**
   * Removes an issue in the merge queue. The removed issue will not be included in the merge workflow.
   *
   * @param {IssueId} id - The ID of the issue to be excluded from merging
   */
  removeIssue(issue_id: IssueId) {
    this.issues_queue.remove(issue_id);
  }

  /**
   * Resets the current merge queue.
   */
  clearIssues() {
    this.issues_queue.clear();
  }

  private parseIssueTags(html: string): string[] {
    const $ = cheerio.load(html);
    const selector = $(".value span.tag-label-color");
    const tags = Object.values(selector)
      .filter((el) => el.name && el.name === "span")
      .map((el) => el.attribs.title);

    return tags;
  }

  /**
   * Retrieves the recently enqueued issue.
   */
  getLastEnqueuedIssue(): Issue | undefined {
    return this.issues_queue.tail;
  }

  /**
   * Initiates merging of one of the earliest enqueued issue. This will merge the issue's pull request, as well as update its status to `Merged` if it has merged successfully.
   *
   * @returns {Issue | undefined} - The issue that was recently merged
   */
  private async dequeueCard(): Promise<Issue | undefined> {
    const issue = this.issues_queue.dequeue();
    if (issue) {
      logger.info(`Merging ${issue.title}...`);
      if (issue.status === "Ready") {
        throw new IssueError(IssueErrorType.STATUS_NOT_READY, issue);
      }
      const pr_url = github.getGitHubPR(issue.description);
      if (pr_url) {
        const pr_id = github.getGitHubPRId(pr_url);
        await github.mergePR(Number(pr_id));
        await this.updateIssue(issue.id, {
          status_id: STATUS.MERGED,
        });
      } else {
        throw new IssueError(IssueErrorType.NEEDS_PULL_REQUEST, issue);
      }
      logger.info(`Successfully merged ${issue.title}!`);
    }
    return issue;
  }

  /**
   * Creates a regression testing issue based on the version supplied.
   * Once the regression testing issue is created, it will assign the merged issues as subtasks to the regression testing issue.
   *
   * @param {Version} version - The version to be tagged along with the regression testing issue
   */
  async createRegressionTestingIssue(version: Version) {
    // TODO: remove mock placeholder once this goes live
    const mock_description =
      "THIS IS A MOCK REGRESSION TESTING CARD FOR RELEASE TESTING PURPOSES, do not merge or test this card";

    console.log("Creating regression testing card...");
    // create the regression testing card first...
    const response = await axios.post(
      `${REDMINE_API_URL}/issues.json`,
      {
        issue: {
          project_id: PROJECT.WEB_TEAM,
          subject: `(Mock regression testing card) Deriv.app Regression testing - ${version.tag}`,
          tracker_id: TRACKER.REGRESSION_TESTING, // regression testing tracker id
          priority_id: PRIORITY.NORMAL, // priority id normal
          status_id: STATUS.NEW,
          assigned_to_id: ASSIGNEE.ADRIENNE, //TODO: Replace with qa user id
          description: `${mock_description}\nPlease refer to this version: http://redmine.deriv.cloud/versions/${version.id}\ntest in staging-app.deriv.com`,
        },
      },
      {
        headers: {
          "X-Redmine-API-Key": REDMINE_API_TOKEN,
        },
      }
    );

    // ...then update all the released issue's parent card to the regression testing card
    const parent_id = response.data.issue.id;
    const update_parent_issue_reqs = this.released_cards.issues.map((issue) => {
      console.log(`Setting parent issue of ${issue.title}...`);
      return this.updateIssue(issue.id, {
        parent_issue_id: parent_id,
      });
    });
    await Promise.allSettled(update_parent_issue_reqs);
    this.released_cards.clear();

    return response;
  }

  /**
   * Creates a new version in Redmine according to the following format: `Deriv.app - YYYYMMDD_0`
   *
   * @param {Version} version - The newly created version
   */
  async createVersion(): Promise<Version> {
    let version_iteration = 0;
    const today = new Date();
    const version_tag = `V${today.getFullYear()}${
      today.getMonth() + 1
    }${today.getDate()}_${version_iteration}`;

    console.log(`Creating version ${version_tag}...`);
    const response = await axios.post(
      `${REDMINE_API_URL}/projects/deriv-app/versions.json`,
      {
        version: {
          name: `(MOCK VERSION) Deriv.app - ${version_tag}`,
          status: "open",
          sharing: "descendants", // sharing set to 'With subprojects'
        },
      },
      {
        headers: {
          "X-Redmine-API-Key": REDMINE_API_TOKEN,
        },
      }
    );

    const version: Version = response.data.version;
    version.tag = version_tag;
    return version;
  }

  /**
   * Merges the issues within the merge queue.
   * If a list of Redmine issue IDs is supplied in the argument, it will only merge issues that matches in the supplied Redmine IDs. Otherwise it will merge all issues in the merge queue.
   * During merging, it will:
   * - Check if the pull request in the issue is applicable to be merged
   * - Once merged, it will wait for approximately 2 minutes for the build to process
   * - Check the CircleCI workflow for the base branch. If the workflow fails, it will immediately stop merging the remaining issues.
   *
   * @param {IssueId[]} redmine_ids - The list of issues to only be merged
   */
  async mergeCards(redmine_ids?: IssueId[]): Promise<[Issue[], IssueError[]]> {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const skipped_issues = new IssueQueue(); // used to restore main queue with the skipped issues if user specifies some issues they wished to skip

    while (!this.issues_queue.is_empty) {
      // variable as reference for dequeued issue in case an error occurs
      let head = this.issues_queue.head as Issue;
      try {
        event_manager.onMergingIssue(head);
        if (redmine_ids?.includes(head?.id) || !redmine_ids) {
          const dequeued_issue = <Issue>await this.dequeueCard(); // assert it exists because we already checked whether the queue is empty
          this.released_cards.enqueue(dequeued_issue);
          event_manager.onMergedIssue(dequeued_issue);
          logger.info(
            `Waiting ${MERGE_DELAY / 60000} minute for build to finish...`
          );
          await sleep(MERGE_DELAY);

          // TODO: Create CircleCI workflow in test repo first to test it out, uncomment this once tested
          logger.info(
            `Checking ${CIRCLECI_WORKFLOW_NAME} pipeline in CircleCI for ${CIRCLECI_BRANCH} branch...`
          );
          await circleci.checkPipelineStatus();
          logger.info(
            `CircleCI workflow checks completed for ${CIRCLECI_BRANCH} branch!`
          );
        } else {
          const skipped_issue = this.issues_queue.dequeue();
          skipped_issues.enqueue(<Issue>skipped_issue);
        }
      } catch (err) {
        this.issues_queue.remove(head.id);
        // in this case when there's an error, do not stop workflow
        if (err instanceof IssueError) {
          if (!err.issue) err.issue = head;
          event_manager.onError(err);

          // if the master branch has failed release_staging workflow, stop release immediately
          if (err.type === IssueErrorType.FAILED_WORKFLOW) {
            logger.info(
              `${CIRCLECI_WORKFLOW_NAME} pipeline in CircleCI has failed, halting release workflow...`
            );
            break;
          }
          logger.info(`Error in merging ${head.title}: ${err.message}`);
          // some issues do not have assignee
          if (head.id && head.assignee) {
            const assignee = await this.fetchUser(head.assignee.id);
            this.failed_issues.push(new IssueError(err.type, head, assignee));
          }
        }
      }
    }

    if (!skipped_issues.is_empty) this.issues_queue = skipped_issues;

    logger.info("Wew! Paimon has released all valid issues!");
    return [this.released_cards.getAllIssues(), this.failed_issues];
  }

  async enQueueCard(redmine_id: IssueId) {
    const card = await this.fetchIssue(redmine_id);
    this.issues_queue.enqueue(card);
  }

  async refetchIssues() {
    const update_issue_reqs = this.issues_queue.issues.map((issue) => {
      return this.fetchIssue(issue.id).then((updated_issue) => {
        console.log(updated_issue.status);
        this.issues_queue.update(updated_issue);
      });
    });
    await Promise.allSettled(update_issue_reqs);
  }

  /**
   * Enqueues a list of Redmine issue links to the merge queue.
   *
   * @param {string[]} redmine_links - The list of Redmine issue links to be enqueued for merging
   */
  async enQueueCards(redmine_links: string[]) {
    this.spinner.start({
      text: "Fetching issues...\n",
    });
    const reqs_enqueues = redmine_links.map((redmine_link) => {
      try {
        const issue_id = this.getIssueId(redmine_link);
        if (issue_id) return this.enQueueCard(issue_id);
      } catch (err) {
        throw new Error(
          `Unable to fetch ${redmine_link}: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
    });

    // do not stop fetching issues even if you encountered an error while fetching an issue
    await Promise.allSettled(reqs_enqueues).catch((err) => console.log(err));
    this.spinner.success();
  }
}

export default new Redmine();
