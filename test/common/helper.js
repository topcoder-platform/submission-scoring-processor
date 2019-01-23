/**
 * Test helper functions
 */

/**
 * Sleep with given time
 * @param time the time to sleep
 */
async function sleep (time) {
  await new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

module.exports = {
  sleep
}
