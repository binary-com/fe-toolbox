import { IssueId } from '../../models/strategy';
import { IssuesView } from '../../utils/views/issues-view';
import MergingIssuesView, { MergingIssuesViewStatus } from '../../utils/views/merging-issues-view';
import { LoadingView } from '../../utils/views/loading-view';
import { IssueStatus } from '../../utils/views/issue-view/issue-view';
import { AddCardModal, MergeAllModal } from '../views/modals';
import { VIEWS, ViewArgsWithTriggerIDs } from '../../models/views';

export enum VIEW_STATE {
    ADDED_ISSUES,
    HAS_MERGED_ISSUE,
    IDLE,
    IS_LOADING,
    IS_MERGING_ISSUE,
}

type Views = {
    [VIEWS.MAIN_VIEW]: IssuesView;
    [VIEWS.MERGING_CARDS_VIEW]: MergingIssuesView;
    [VIEWS.LOADING_VIEW]: LoadingView;
};

type Modals = {
    [VIEWS.MERGE_ALL_MODAL]: MergeAllModal;
    [VIEWS.ADD_CARD_MODAL]: AddCardModal;
};

type ViewsWithMethod<T, V> = {
    [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

// type ViewsWithUpdate = {
//     [K in keyof Views]: Views[K]["update"] extends (...args: any[]) => any ? Views[K] : never
// }[keyof Views]

/**
 * The view manager is responsible for instantiating/mounting and loading views as well as managing all the view instances.
 * It is a centralized store for all the view instances and manages how they are called for certain actions/events.
 */
class ViewManager {
    private _current_view: VIEWS = VIEWS.MAIN_VIEW; // we need to add a default state
    private views: Views;
    private modals: Modals;

    constructor() {
        this._current_view = VIEWS.MAIN_VIEW;

        this.views = {
            [VIEWS.MAIN_VIEW]: new IssuesView(),
            [VIEWS.MERGING_CARDS_VIEW]: new MergingIssuesView(),
            [VIEWS.LOADING_VIEW]: new LoadingView(),
        };
        this.modals = {
            [VIEWS.ADD_CARD_MODAL]: new AddCardModal(),
            [VIEWS.MERGE_ALL_MODAL]: new MergeAllModal(),
        };
    }

    get current_view() {
        return this._current_view;
    }

    get has_workflow_error() {
        return this.getView(VIEWS.MERGING_CARDS_VIEW).status.has_workflow_error;
    }

    loadView<T extends ViewsWithMethod<Views, { load: any }>>(view_type: T): Views[T]['load'] {
        return this.views[view_type].load;
    }

    mountView<T extends ViewsWithMethod<Views, { mount: any }>>(
        view_type: T,
        issues_to_be_released?: IssueId[]
    ): Views[T]['mount'] {
        if (view_type === VIEWS.MERGING_CARDS_VIEW && issues_to_be_released) {
            issues_to_be_released.forEach(issue_id => {
                const issue_view = this.getView(VIEWS.MAIN_VIEW).getIssueView(issue_id);
                if (issue_view) {
                    issue_view.setStatus({
                        should_be_released: true,
                        queued: true,
                        has_error: false,
                    });
                }
            });
        }

        this.setCurrentView(view_type);
        return this.views[view_type].mount;
    }

    updateView<T extends ViewsWithMethod<Views, { update: any }>>(view_type: T): Views[T]['update'] {
        return this.views[view_type].update;
    }

    loadModal<T extends keyof Modals>(modal_type: T): Modals[T]['load'] {
        return this.modals[modal_type].load;
    }

    mountModal<T extends keyof Modals>(modal_type: T): Modals[T]['mount'] {
        return this.modals[modal_type].mount;
    }

    getView<T extends keyof Views>(view_type: T): Views[T] {
        return this.views[view_type];
    }

    mountOnAppHomeOpened() {
        return this.getView(VIEWS.MAIN_VIEW).mountOnAppHomeOpened;
    }

    mountReleaseCardModal() {
        return async <T extends ViewArgsWithTriggerIDs>(args: T) => {
            await this.mountModal(VIEWS.MERGE_ALL_MODAL)(args, this.getView(VIEWS.MAIN_VIEW).getAllIssueViews());
        };
    }

    setIssueViewStatus(id: IssueId, status: Partial<IssueStatus>) {
        this.getView(VIEWS.MAIN_VIEW).getIssueView(id)?.setStatus(status);
    }

    setMergingIssuesViewStatus(status: Partial<MergingIssuesViewStatus>) {
        this.getView(VIEWS.MERGING_CARDS_VIEW).setMergingIssuesViewStatus(status);
    }

    setCurrentView<T extends VIEWS>(view: T) {
        this._current_view = view;
    }
}

export default new ViewManager();
