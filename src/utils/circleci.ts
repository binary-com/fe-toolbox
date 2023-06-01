import {
  CIRCLECI_TOKEN,
  CIRCLECI_BRANCH,
  CIRCLECI_PROJECT_SLUG,
  CIRCLECI_WORKFLOW_NAME,
} from "./config";
import { CIRCLECI_API_URL } from "../models/constants";
import {
  Pipeline,
  PipelineResponse,
  Workflow,
  WorkflowResponse,
} from "../models/circleci";
import { IssueError, IssueErrorType } from "../models/error";
import Http from "./http";

class CircleCI {
  /**
   * Retrieves a list of pipelines for a project based on a branch
   *
   * @async
   * @param project_slug - The project slug in form of `vcs-slug/org-name/repo-name`
   * @param branch - The branch name running the pipelines
   */

  running_checks: Set<string>;
  http: Http;

  constructor() {
    this.running_checks = new Set();
    this.http = new Http(CIRCLECI_API_URL, {
      auth: {
        username: CIRCLECI_TOKEN,
        password: "",
      },
    });
  }

  async getPipelines(
    project_slug: string,
    branch: string
  ): Promise<Pipeline[]> {
    const { items } = await this.http.get<PipelineResponse>(
      `project/${project_slug}/pipeline?branch=${branch}`
    );

    return items;
  }

  /**
   * Retrieves all the workflows for a pipeline
   *
   * @async
   * @param pipeline_id - The ID of the pipeline to retrieve
   */
  async getPipelineWorkflows(pipeline_id: string): Promise<Workflow[]> {
    const { items } = await this.http.get<WorkflowResponse>(
      `pipeline/${pipeline_id}/workflow`
    );

    return items;
  }

  /**
   * Checks the pipeline status for running workflows in the staging workflow.
   * It checks for currently running pipelines after a merge, and if one of the running pipelines has failed, then it throws an error to stop the release workflow.
   *
   * @async
   * @param workflow_count - The limit of workflow checks to perform, by default maximum workflows to check is 15
   * @returns {boolean} - `true` if the latest pipeline matches the supplied `pipeline_status`
   */
  async checkPipelineStatus(workflow_count: number = 15): Promise<void> {
    const pipelines = await this.getPipelines(
      CIRCLECI_PROJECT_SLUG,
      CIRCLECI_BRANCH
    );
    if (pipelines.length) {
      for (let i = 0; i < workflow_count; i++) {
        const pipeline = pipelines[i];
        const workflows = await this.getPipelineWorkflows(pipeline.id);
        const release_workflow = workflows.find(
          (workflow) => workflow.name === CIRCLECI_WORKFLOW_NAME
        );
        if (release_workflow) {
          if (
            release_workflow.status === "failed" &&
            this.running_checks.has(pipeline.id)
          ) {
            throw new IssueError(
              IssueErrorType.FAILED_WORKFLOW,
              undefined,
              undefined
            );
          }
          if (release_workflow.status === "running") {
            this.running_checks.add(pipeline.id);
          }
        }
      }
    }
  }
}

export default new CircleCI();
