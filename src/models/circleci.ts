export type Workflow = {
    pipeline_id: string;
    id: string;
    name: string;
    project_slug: string;
    status: string;
    started_by: string;
    pipeline_number: number;
    created_at: string;
    stopped_at: string;
};

export type Pipeline = {
    id: string;
    errors: string[];
    project_slug: string;
    updated_at: string;
    number: number;
    state: string;
    created_at: string;
    trigger: {
        received_at: string;
        type: string;
        actor: {
            login: string;
            avatar_url: string | null;
        };
    };
    vcs: {
        origin_repository_url: string;
        target_repository_url: string;
        revision: string;
        provider_name: string;
        commit: {
            body: string;
            subject: string;
        };
        branch: string;
    };
};

export type WorkflowResponse = {
    items: Workflow[];
    next_page_token: string;
};

export type PipelineResponse = {
    items: Pipeline[];
    next_page_token: string;
};
