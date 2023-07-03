/**
 *  Extracts version string from task name
 * @param {String}  task_name // The name of the task from which the version will be extracted
 * @returns {String} // The version string extracted from the task name
 */
export const extractVersionFromTaskName = (task_name = '') => {
    const regex = /V\d+/; // Match the version string (V followed by digits)
    const matches = task_name.match(regex);

    return matches && matches.length > 0 ? matches[0] : ''; // Extract the first matched string if it exists
};

/**
 *Extracts the task id and team id from the url
 * @param { String } url // The url of the task from which the task id and team id will be extracted
 * @returns { Object } // An object containing the task id and team id
 */
export const getTaskIdAndTeamIdFromUrl = (url: string) => {
    const pattern = /https:\/\/app\.clickup\.com\/t\/([\w-]*)\/*([\w-]*)/; // Matches the task id and team id from the url
    const matches = pattern.exec(url);
    const ids = matches?.slice(matches.length - 2) ?? ['', ''];
    let task_id = '';
    let team_id = '';

    if (ids.length > 0 && ids[ids.length - 1]) {
        [team_id, task_id] = ids;
    } else {
        [task_id] = ids;
    }

    return { task_id, team_id };
};
