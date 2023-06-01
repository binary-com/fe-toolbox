import { ReleaseWorkflow } from './utils/workflow';

const main = async () => {
    // slack.startBot();
    const workflow = new ReleaseWorkflow();
    await workflow.run();
};

(async () => {
    await main();
})();
