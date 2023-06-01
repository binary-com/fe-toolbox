import { ImageBlock } from '@slack/types';
import { Window } from '..';
import github from 'utils/github';
import { GITHUB_REPO, GITHUB_REPO_OWNER } from 'utils/config';

export class IssueStatusView implements Window {
    pr_link: string;

    constructor(pr_link: string) {
        this.pr_link = pr_link;
    }

    load(): ImageBlock {
        if (this.pr_link) {
            const pr_id = github.getGitHubPRId(this.pr_link);
            return {
                type: 'image',
                image_url: `https://img.shields.io/github/status/contexts/pulls/${GITHUB_REPO_OWNER}/${GITHUB_REPO}/${pr_id}.png?style=for-the-badge`,
                alt_text: 'cute cat',
            };
        } else {
            return {
                type: 'image',
                image_url: `https://img.shields.io/badge/ERROR-NO%20PULL%20REQUEST%20LINK%20IN%20ISSUE%20DESCRIPTION-red.png?style=for-the-badge`,
                alt_text: 'cute dog',
            };
        }
    }
}
