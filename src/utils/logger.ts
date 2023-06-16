const icons = Object.freeze({
    loading: '⏳',
    success: '✅',
    error: '❌',
    warning: '🟡'
});

class Logger {
    private lock: boolean;
    private log_reqs: Promise<void>[];
    private logs: string[];

    constructor() {
        this.lock = false;
        this.log_reqs = [];
        this.logs = [];
    }

    private getCurrentDate(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        const hours = ('0' + date.getHours()).slice(-2);
        const minutes = ('0' + date.getMinutes()).slice(-2);
        const seconds = ('0' + date.getSeconds()).slice(-2);

        return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    }

    log(msg: string, type?: 'loading' | 'success' | 'error' | 'warning') {
        const formatted_msg = `[${this.getCurrentDate()}] ${type ? `${icons[type]} ` : ''}${msg}`;
        console.log(formatted_msg);
    }

    /**
     * Logs the supplied message string `msg` to the logger view as well as console logs it.
     *
     * @param {string} msg - The message to be logged
     */
    async info(msg: string) {
        const formatted_msg = `[${this.getCurrentDate()}] ${msg}`;
        this.logs.push(formatted_msg);
        console.log(formatted_msg);

        if (!this.lock) {
            this.lock = true;
            this.log_reqs.push(
                (async () => {
                    // if (this.logs.length) {
                    //     await view_manager.updateView(VIEWS.MERGING_CARDS_VIEW)();
                    // }
                    this.lock = false;
                })()
            );
        }
    }

    /**
     * Waits for any remaining logs that are buffered to be logged in the logger view.
     */
    async waitForAllLogs() {
        await Promise.allSettled(this.log_reqs);
        this.log_reqs = [];
    }

    getAllLogs() {
        return this.logs.join('\n');
    }

    clearLogs() {
        this.logs = [];
    }
}

export default new Logger();
