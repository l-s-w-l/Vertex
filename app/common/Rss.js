const rss = require('../libs/rss');
const util = require('../libs/util');
const logger = require('../libs/logger');
const redis = require('../libs/redis');
const cron = require('node-cron');
const bencode = require('bencode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const Push = require('./Push');

class Rss {
  constructor (rss) {
    this._rss = rss;
    this.id = rss.id;
    this.maxSleepTime = rss.maxSleepTime;
    this.lastRssTime = 0;
    this.alias = rss.alias;
    this.urls = rss.rssUrls;
    this.clientArr = rss.clientArr || [rss.client];
    this.clientSortBy = rss.clientSortBy;
    this.autoReseed = rss.autoReseed;
    this.onlyReseed = rss.onlyReseed;
    this.reseedClients = rss.reseedClients;
    this.pushMessage = rss.pushMessage;
    this.skipSameTorrent = rss.skipSameTorrent;
    this.scrapeFree = rss.scrapeFree;
    this.scrapeHr = rss.scrapeHr;
    this.sleepTime = rss.sleepTime;
    this.cookie = rss.cookie;
    this.savePath = rss.savePath;
    this.category = rss.category;
    this.addCountPerHour = +rss.addCountPerHour || 20;
    this.addCount = 0;
    this.pushTorrentFile = rss.pushTorrentFile;
    this.notify = util.listPush().filter(item => item.id === rss.notify)[0] || {};
    this.notify.push = rss.pushNotify;
    this.ntf = new Push(this.notify);
    this._acceptRules = rss.acceptRules || [];
    this._rejectRules = rss.rejectRules || [];
    this.acceptRules = util.listRssRule().filter(item => (this._acceptRules.indexOf(item.id) !== -1));
    this.rejectRules = util.listRssRule().filter(item => (this._rejectRules.indexOf(item.id) !== -1));
    this.downloadLimit = util.calSize(rss.downloadLimit, rss.downloadLimitUnit);
    this.uploadLimit = util.calSize(rss.uploadLimit, rss.uploadLimitUnit);
    this.maxClientUploadSpeed = util.calSize(rss.maxClientUploadSpeed, rss.maxClientUploadSpeedUnit);
    this.maxClientDownloadSpeed = util.calSize(rss.maxClientDownloadSpeed, rss.maxClientDownloadSpeedUnit);
    this.maxClientDownloadCount = +rss.maxClientDownloadCount;
    this.rssJob = cron.schedule(rss.cron, async () => { try { await this.rss(); } catch (e) { logger.error(this.alias, e); } });
    this.clearCount = cron.schedule('0 * * * *', () => { this.addCount = 0; });
    logger.info('Rss ??????', this.alias, '???????????????');
  }

  _all (str, keys) {
    if (!keys || keys.length === 0) return true;
    for (const key of keys) {
      if (str.indexOf(key) === -1) return false;
    }
    return true;
  };

  _sum (arr) {
    let sum = 0;
    for (const item of arr) {
      sum += item;
    }
    return sum;
  }

  _getSum (a, b) {
    return a + b;
  };

  async _downloadTorrent (url) {
    const res = await util.requestPromise({
      url: url,
      method: 'GET',
      encoding: null,
      headers: {
        cookie: this.cookie
      }
    });
    const buffer = Buffer.from(res.body, 'utf-8');
    const torrent = bencode.decode(buffer);
    const size = torrent.info.length || torrent.info.files.map(i => i.length).reduce(this._getSum, 0);
    const fsHash = crypto.createHash('sha1');
    fsHash.update(bencode.encode(torrent.info));
    const md5 = fsHash.digest('md5');
    let hash = '';
    for (const v of md5) {
      hash += v < 16 ? '0' + v.toString(16) : v.toString(16);
    };
    const filepath = path.join(__dirname, '../../torrents', hash + '.torrent');
    fs.writeFileSync(filepath, buffer);
    return {
      filepath,
      hash,
      size,
      name: torrent.info.name.toString()
    };
  };

  _fitConditions (_torrent, conditions) {
    let fit = true;
    const torrent = { ..._torrent };
    for (const condition of conditions) {
      let value;
      switch (condition.compareType) {
      case 'equals':
        fit = fit && (torrent[condition.key] === condition.value || torrent[condition.key] === +condition.value);
        break;
      case 'bigger':
        value = 1;
        condition.value.split('*').forEach(item => {
          value *= +item;
        });
        fit = fit && torrent[condition.key] > value;
        break;
      case 'smaller':
        value = 1;
        condition.value.split('*').forEach(item => {
          value *= +item;
        });
        fit = fit && torrent[condition.key] < value;
        break;
      case 'contain':
        fit = fit && condition.value.split(',').filter(item => torrent[condition.key].indexOf(item) !== -1).length !== 0;
        break;
      case 'includeIn':
        fit = fit && condition.value.split(',').indexOf(torrent[condition.key]) !== -1;
        break;
      case 'notContain':
        fit = fit && condition.value.split(',').filter(item => torrent[condition.key].indexOf(item) !== -1).length === 0;
        break;
      case 'notIncludeIn':
        fit = fit && condition.value.split(',').indexOf(torrent[condition.key]) === -1;
        break;
      case 'regExp':
        fit = fit && (torrent[condition.key] + '').match(new RegExp(condition.value));
        break;
      case 'notRegExp':
        fit = fit && !(torrent[condition.key] + '').match(new RegExp(condition.value));
        break;
      }
    }
    return fit;
  }

  _fitRule (_rule, _torrent) {
    const rule = { ..._rule };
    const torrent = { ..._torrent };
    if (rule.type === 'javascript') {
      try {
        // eslint-disable-next-line no-eval
        return (eval(rule.code))(torrent);
      } catch (e) {
        logger.error(this.alias, 'Rss ??????', rule.alias, '??????????????????\n', e);
        return false;
      }
    } else {
      try {
        return rule.conditions.length !== 0 && this._fitConditions(torrent, rule.conditions);
      } catch (e) {
        logger.error(this.alias, 'Rss ??????', rule.alias, '????????????\n', e);
        return false;
      }
    }
  }

  destroy () {
    logger.info('?????? Rss ??????:', this.alias);
    this.rssJob.stop();
    delete this.rssJob;
    this.clearCount.stop();
    delete this.clearCount;
    delete global.runningRss[this.id];
  }

  reloadRssRule () {
    logger.info('???????????? Rss ??????', this.alias);
    this.acceptRules = util.listRssRule().filter(item => (this._acceptRules.indexOf(item.id) !== -1));
    this.rejectRules = util.listRssRule().filter(item => (this._rejectRules.indexOf(item.id) !== -1));
  }

  reloadPush () {
    logger.info('Rss', this.alias, '????????????????????????');
    this.notify = util.listPush().filter(item => item.id === this._rss.notify)[0] || {};
    this.notify.push = this._rss.pushNotify;
    this.ntf = new Push(this.notify);
  }

  async _pushTorrent (torrent, _client) {
    if (this.autoReseed && torrent.hash.indexOf('fakehash') === -1) {
      for (const key of this.reseedClients) {
        const client = global.runningClient[key];
        if (!client) {
          logger.error('Rss', this.alias, '?????????', key, '?????????');
          continue;
        }
        for (const _torrent of client.maindata.torrents) {
          if (+_torrent.size === +torrent.size && +_torrent.completed === +_torrent.size) {
            const bencodeInfo = await rss.getTorrentNameByBencode(torrent.url);
            if (_torrent.name === bencodeInfo.name && _torrent.hash !== bencodeInfo.hash) {
              try {
                this.addCount += 1;
                await client.addTorrent(torrent.url, torrent.hash, true, this.uploadLimit, this.downloadLimit, _torrent.savePath, this.category);
                await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, category, link, record_time, add_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [torrent.hash, torrent.name, torrent.size, this.id, this.category, torrent.link, moment().unix(), moment().unix(), 1, '??????']);
                await this.ntf.addTorrent(this._rss, client, torrent);
                return;
              } catch (error) {
                logger.error(this.alias, '?????????', client, '????????????', torrent.name, '??????\n', error);
                await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, category, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [torrent.hash, torrent.name, torrent.size, this.id, this.category, torrent.link, moment().unix(), 3, '????????????']);
                await this.ntf.addTorrentError(this._rss, client, torrent);
              }
            }
          }
        }
      }
    }
    if (!this.onlyReseed) {
      let speed;
      if (_client.sameServerClients) {
        speed = {
          uploadSpeed: this._sum(_client.sameServerClients.map(index => global.runningClient[index]?.maindata?.uploadSpeed || 0)),
          downloadSpeed: this._sum(_client.sameServerClients.map(index => global.runningClient[index]?.maindata?.downloadSpeed || 0))
        };
      } else {
        speed = {
          uploadSpeed: _client.maindata.uploadSpeed,
          downloadSpeed: _client.maindata.downloadSpeed
        };
      }
      if (_client.maxUploadSpeed && speed.uploadSpeed > _client.maxUploadSpeed) {
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, `????????????: ????????????????????????????????? ${util.formatSize(speed.uploadSpeed)}/s`]);
        await this.ntf.rejectTorrent(this._rss, _client, torrent, `????????????: ????????????????????????????????? ${util.formatSize(speed.uploadSpeed)}/s`);
        return;
      }
      if (_client.maxDownloadSpeed && speed.downloadSpeed > _client.maxDownloadSpeed) {
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, `????????????: ????????????????????????????????? ${util.formatSize(speed.downloadSpeed)}/s`]);
        await this.ntf.rejectTorrent(this._rss, _client, torrent, `????????????: ????????????????????????????????? ${util.formatSize(speed.downloadSpeed)}/s`);
        return;
      }
      const leechNum = _client.maindata.leechingCount;
      if (_client.maxLeechNum && leechNum >= _client.maxLeechNum) {
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, `????????????: ????????????????????????????????? ${leechNum}`]);
        await this.ntf.rejectTorrent(this._rss, _client, torrent, `????????????: ????????????????????????????????? ${leechNum}`);
        return;
      }
      if (_client.minFreeSpace && _client.maindata.freeSpaceOnDisk <= _client.minFreeSpace) {
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, `????????????: ????????????????????????????????? ${util.formatSize(_client.maindata.freeSpaceOnDisk)}`]);
        await this.ntf.rejectTorrent(this._rss, _client, torrent, `????????????: ????????????????????????????????? ${util.formatSize(_client.maindata.freeSpaceOnDisk)}`);
        return;
      }
      const fitRules = this.acceptRules.filter(item => this._fitRule(item, torrent));
      if (fitRules.length === 0 && this.acceptRules.length !== 0) {
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, '????????????: ?????????????????????']);
        await this.ntf.rejectTorrent(this._rss, _client, torrent, '????????????: ?????????????????????');
        return;
      }
      if (this.scrapeFree) {
        try {
          if (!await util.scrapeFree(torrent.link, this.cookie)) {
            const isScraped = await redis.get(`vertex:scrape:free:${torrent.hash}`);
            if (this.sleepTime && (moment().unix() - +this.sleepTime) < torrent.pubTime && !isScraped) {
              logger.info(this.alias, '?????????????????????', this.sleepTime, ', ', torrent.name, '???????????????', moment(torrent.pubTime * 1000).format('YYYY-MM-DD HH:mm:ss'), ', ??????');
              await redis.setWithExpire(`vertex:scrape:free:${torrent.hash}`, '7777', 3600 * 4);
            } else {
              await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
                [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, '????????????: ????????????']);
            }
            await this.ntf.rejectTorrent(this._rss, _client, torrent, '????????????: ????????????');
            return;
          }
        } catch (e) {
          logger.error(this.alias, '????????????????????????: ', e.message);
          await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
            [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, `????????????: ???????????????????????? ${e.message}`]);
          await this.ntf.scrapeError(this._rss, torrent);
          return;
        }
      }
      if (this.scrapeHr) {
        try {
          if (await util.scrapeHr(torrent.link, this.cookie)) {
            await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
              [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, '????????????: HR']);
            await this.ntf.rejectTorrent(this._rss, _client, torrent, '????????????: HR');
            return;
          }
        } catch (e) {
          logger.error(this.alias, '?????? HR ????????????: ', e.message);
          await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
            [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, `????????????: ?????? HR ???????????? ${e.message}`]);
          await this.ntf.scrapeError(this._rss, torrent);
          return;
        }
      }
      if (this.skipSameTorrent) {
        for (const key of Object.keys(global.runningClient)) {
          const client = global.runningClient[key];
          if (!client || !client.maindata || client._client.type !== 'qBittorrent') {
            continue;
          }
          for (const _torrent of client.maindata.torrents) {
            if (+_torrent.size === +torrent.size) {
              await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
                [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, '????????????: ?????????????????????']);
              await this.ntf.rejectTorrent(this._rss, _client, torrent, '????????????: ?????????????????????');
              return;
            }
          }
        }
        const sameTorrent = await util.getRecord('select * from torrents where size = ? and add_time > ?', [torrent.size, moment().unix() - 1200]);
        if (sameTorrent && sameTorrent.id) {
          await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
            [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, '????????????: ?????????????????????']);
          await this.ntf.rejectTorrent(this._rss, _client, torrent, '????????????: ?????????????????????');
          return;
        }
      }
      try {
        this.addCount += 1;
        if (this.pushTorrentFile) {
          const { filepath, hash } = await this._downloadTorrent(torrent.url);
          await _client.addTorrentByTorrentFile(filepath, hash, false, this.uploadLimit, this.downloadLimit, this.savePath, this.category);
        } else {
          await _client.addTorrent(torrent.url, torrent.hash, false, this.uploadLimit, this.downloadLimit, this.savePath, this.category);
        }
        await this.ntf.addTorrent(this._rss, _client, torrent);
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, category, record_time, add_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, this.category, moment().unix(), moment().unix(), 1, '????????????']);
      } catch (error) {
        logger.error(this.alias, '?????????', _client.alias, '??????????????????:', error.message);
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 3, '??????????????????']);
        await this.ntf.addTorrentError(this._rss, _client, torrent);
      }
    }
  }

  async rss () {
    const torrents = (await Promise.all(this.urls.map(url => rss.getTorrents(url)))).flat();
    const availableClients = this.clientArr
      .map(item => global.runningClient[item])
      .filter(item => {
        return !!item && !!item.status && !!item.maindata &&
          (!this.maxClientUploadSpeed || this.maxClientUploadSpeed > item.maindata.uploadSpeed) &&
          (!this.maxClientDownloadSpeed || this.maxClientDownloadSpeed > item.maindata.downloadSpeed) &&
          (!this.maxClientDownloadCount || this.maxClientDownloadCount > item.maindata.leechingCount);
      });
    const firstClient = availableClients
      .filter(item => {
        return (!item.maxDownloadSpeed || item.maxDownloadSpeed > item.maindata.downloadSpeed) &&
          (!item.maxUploadSpeed || item.maxUploadSpeed > item.maindata.uploadSpeed) &&
          (!item.maxLeechNum || item.maxLeechNum > item.maindata.leechingCount) &&
          (!item.minFreeSpace || item.minFreeSpace < item.maindata.freeSpaceOnDisk);
      })
      .sort((a, b) => a.maindata[this.clientSortBy] - b.maindata[this.clientSortBy])[0] || availableClients[0];
    for (const torrent of torrents) {
      const sqlRes = await util.getRecord('SELECT * FROM torrents WHERE hash = ? AND rss_id = ?', [torrent.hash, this.id]);
      if (sqlRes && sqlRes.id) continue;
      if (torrent.name.indexOf('[FROZEN]') !== -1) continue;
      if (this.addCount >= this.addCountPerHour) {
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, `????????????: ???????????????????????????: ${this.addCount} / ${this.addCountPerHour}`]);
        await this.ntf.rejectTorrent(this._rss, undefined, torrent, `????????????: ???????????????????????????: ${this.addCount} / ${this.addCountPerHour}`);
        return;
      }
      if (moment().unix() - this.lastRssTime > +this.maxSleepTime) {
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, '????????????: ??????????????????']);
        await this.ntf.rejectTorrent(this._rss, undefined, torrent, '????????????: ??????????????????');
        continue;
      }
      if (!firstClient) {
        await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
          [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, '????????????: ??????????????????']);
        await this.ntf.rejectTorrent(this._rss, undefined, torrent, '????????????: ??????????????????');
        logger.error(this.alias, '??????????????????');
        continue;
      }
      let reject = false;
      for (const rejectRule of this.rejectRules) {
        if (this._fitRule(rejectRule, torrent)) {
          await util.runRecord('INSERT INTO torrents (hash, name, size, rss_id, link, record_time, record_type, record_note) values (?, ?, ?, ?, ?, ?, ?, ?)',
            [torrent.hash, torrent.name, torrent.size, this.id, torrent.link, moment().unix(), 2, `????????????: ${rejectRule.alias}`]);
          await this.ntf.rejectTorrent(this._rss, undefined, torrent, `????????????: ${rejectRule.alias}`);
          reject = true;
          break;
        }
      }
      if (!reject) {
        await this._pushTorrent(torrent, firstClient);
      }
    }
    this.lastRssTime = moment().unix();
  }
}
module.exports = Rss;
