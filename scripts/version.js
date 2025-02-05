function isNumeric(input) {
    return (typeof input === 'number') || (!isNaN(parseFloat(input)) && isFinite(input));
}

const strToNum = (str) => {
    return parseInt(str);
};

// Thank you https://semver.org/
const semverregex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const compareAsStringOrNumber = (a, b) => {
  const anum = isNumeric(a);
  const bnum = isNumeric(b);

  if (anum && bnum) {
    a = +a;
    b = +b;
  }
  if (a === b) return 0;
  if (anum && !bnum) return -1;
  if (bnum && !anum) return 1;
  if (a < b) return -1;
  return 1;
};

export default class Version {
  major = 0;
  minor = 0;
  patch = 0;
  prerelease;
  build;

  presplit = [];
  constructor(major, minor, patch, prerelease, build) {
    this.setVersion(major, minor, patch, prerelease, build);
  }
  setVersion(major, minor, patch, prerelease, build) {
    if (major instanceof Version) {
      this.major = major.major;
      this.minor = major.minor;
      this.patch = major.patch;
      this.presplit = major.presplit;
      this.build = major.build;
    } else if (typeof major === 'object') {
      ({ major = 0, minor, patch = 0, prerelease, build } = major);
      this.major = (typeof major === 'string' ? strToNum(major) : major);
      this.minor = (typeof minor === 'string' ? strToNum(minor) : minor) ?? (this.major === 0 ? 1 : 0);
      this.patch = (typeof patch === 'string' ? strToNum(patch) : patch);
      this.prerelease = prerelease;
      this.build = build;
    } else if (typeof major === 'string' && typeof minor === 'undefined') {
      ({ major, minor, patch, prerelease, build } = Version.parse(major));
      this.major = major;
      this.minor = minor;
      this.patch = patch;
      this.prerelease = prerelease;
      this.build = build;
    } else {
      major = (typeof major === 'string' ? strToNum(major) : major);
      minor = (typeof minor === 'string' ? strToNum(minor) : minor);
      patch = (typeof patch === 'string' ? strToNum(patch) : patch);

      this.major = major;
      this.minor = minor ?? (major === 0 ? 1 : 0);
      this.patch = patch;
      this.prerelease = prerelease;
      this.build = build;
    }
  }

  static parse (verstr) {
    const matches = semverregex.exec(verstr);
    if (matches === null) {
      throw new Error('Invalid semver string.');
    }
    let [major, minor, patch, prerelease, build] = Array.from(matches).slice(1);
    major = strToNum(major);
    minor = strToNum(minor);
    patch = strToNum(patch);
    return new Version({ major, minor, patch, prerelease, build });
  }

  toString () {
    let str = `${this.major}.${this.minor}.${this.patch}`;
    if (this.presplit.length > 0) {
      str = `${str}-${this.presplit.join('.')}`;
    }
    if (typeof this.build !== 'undefined') {
      str = `${str}+${this.build}`;
    }
    return str;
  }

  comparePrerelease (other) {
    const otherver = new Version(other);
    if (this.presplit.length && !otherver.presplit.length) {
      return -1;
    } else if (!this.presplit.length && otherver.presplit.length) {
      return 1;
    } else if (!this.presplit.length && !otherver.presplit.length) {
      return 0;
    }

    let i = 0;
    do {
      const a = this.presplit[i];
      const b = otherver.presplit[i];
      if (a === undefined && b === undefined) {
        return 0;
      } else if (b === undefined) {
        return 1;
      } else if (a === undefined) {
        return -1;
      } else if (a === b) {
        continue;
      } else {
        return compareAsStringOrNumber(a, b);
      }
    } while (++i);
    return 0;
  }

  gt (other) {
    const otherver = new Version(other);
    if (this.presplit.length > 0 && otherver.presplit.length > 0) {
      if (this.sameVer(otherver)) {
        const r = this.comparePrerelease(otherver);
        if (r <= 0) {
          return false;
        } else {
          return true;
        }
      } else {
        return false;
      }
    }
    if (this.major > otherver.major) {
      return true;
    }
    if (this.major < otherver.major) {
      return false;
    }
    if (this.minor > otherver.minor) {
      return true;
    }
    if (this.minor < otherver.minor) {
      return false;
    }
    if (this.patch > otherver.patch) {
      return true;
    }
    if (this.patch < otherver.patch) {
      return false;
    }
    if (this.presplit.length === 0 && otherver.presplit.length > 0) {
      return true;
    }
    return false;
  }

  gteq (other) {
    const otherver = new Version(other);
    return this.gt(otherver) || this.eq(otherver);
  }

  sameVer (other) {
    const otherver = new Version(other);
    return this.major === otherver.major &&
      this.minor === otherver.minor &&
      this.patch === otherver.patch;
  }

  eq (other) {
    const otherver = new Version(other);
    return this.sameVer(otherver) &&
      this.samePre(otherver);
  }

  samePre (other) {
    const otherver = new Version(other);
    return this.prerelease === otherver.prerelease;
  }

  same (other) {
    const otherver = new Version(other);
    return this.eq(other) &&
      this.build === otherver.build;
  }

  lt (other) {
    const otherver = new Version(other);
    return !this.gteq(otherver);
  }

  lteq (other) {
    return this.lt(other) || this.eq(other);
  }
}



const versionTest = () => {
  const versions = [
    ['1.0.0', '1.0.0', false, false, true, true, true],
    ['1.1.0', '1.0.0', false, true, false, true, false],
    ['1.2.0', '1.0.0', false, true, false, true, false],
    ['1.2.0', '1.1.1', false, true, false, true, false],
    ['2.2.1', '1.2.1', false, true, false, true, false],
    ['1.1.1', '1.2.0', true, false, true, false, false],
  ];

  for (const [v1, v2, lt, gt, lteq, gteq, eq] of versions) {
    const results = {
      lt: {
        result:(new Version(v1)).lt(v2),
        expected: lt,
        symbol: '<',
      },
      gt: {
        result:(new Version(v1)).gt(v2),
        expected: gt,
        symbol: '>',
      },
      lteq: {
        result:(new Version(v1)).lteq(v2),
        expected: lteq,
        symbol: '<=',
      },
      gteq: {
        result:(new Version(v1)).gteq(v2),
        expected: gteq,
        symbol: '>=',
      },
      eq: {
        result:(new Version(v1)).eq(v2),
        expected: eq,
        symbol: '==',
      },
    };
    for (const [fn, result] of Object.entries(results)) {
      if (result.expected !== result.result) {
        console.log(`${v1} ${result.symbol} ${v2} = ${result.expected?'true':'false'} but got ${result.result?'true':'false'}`);
      }
    }
  }
};