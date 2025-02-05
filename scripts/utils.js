export function parseTimeString(timeString) {
  const multipliers = {
    s: 1000,
    second: 1000,
    seconds: 1000,
    ms: 1,
    millisecond: 1,
    milliseconds: 1,
    m: 1000 * 60,
    minute: 1000 * 60,
    minutes: 1000 * 60,
    h: 1000 * 60 * 60,
    hour: 1000 * 60 * 60,
    hours: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
    day: 1000 * 60 * 60 * 24,
    days: 1000 * 60 * 60 * 24,
  };
  const matchRegex = /([0-9]+[0-9.]*) *(ms|milliseconds?|s|seconds?|m|minutes?|h|hours?|d|days?)?/;
  const matches = `${timeString}`.match(matchRegex);
  if (matches) {
    let [proxy, num, unit] = matches;
    if (num) {
      num = parseFloat(num);
      if (unit && typeof multipliers[unit] !== 'undefined') {
        num *= multipliers[unit];
      }
      if (num <= 0) {
        throw new Error('Timeout must be positive.');
      }
      return num;
    }
  }
  throw new Error(`Invalid time string ${timeString} - please check CSS Easy Reload settings.`);
}