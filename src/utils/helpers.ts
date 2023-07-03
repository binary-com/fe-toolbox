/**
 *  Extract version string from task name
 * @param {String}  task_name // The name of the task from which the version will be extracted
 * @returns {String} // The version string extracted from the task name
 */
const extractVersionFromTaskName = (task_name = '') => {
    const regex = /V\d+/; // Match the version string (V followed by digits)

    const matches = task_name.match(regex);

    return matches && matches.length > 0 ? matches[0] : ''; // Extract the first matched string if it exists
};
