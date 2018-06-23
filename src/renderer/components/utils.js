import pinyin from "pinyin"
import driveList from "drivelist"
import _ from "underscore"
import fileURL from "file-url"
import md5 from 'md5'
import axios from 'axios'

function copyObj(obj) {
  return JSON.parse(JSON.stringify(obj))
}

async function parseUSB2Vol(des, idx, par, size) {
  let dev = await new Promise((res, rej) => {
    driveList.list((err, dev) => {
      if (err) {
        rej(err);
        return;
      }
      res(dev);
    });
  });
  dev = dev.filter(
    x =>
      x.description == des && x.mountpoints.length == par && x.size == size
  );
  return dev.map(x => x.mountpoints[idx].path);
}

function parse2ConfigFormat(path, cbk) {
  typeof path === "string" &&
    cbk instanceof Function &&
    driveList.list((err, dev) => {
      if (err) {
        console.error(err);
        return;
      }
      let tmpBlk = {
        volume: "",
        isPortable: false,
        description: "",
        mountIndex: 0,
        partitions: 0,
        size: 0
      };
      dev.forEach(e => {
        e.mountpoints.forEach((p, i) => {
          if (
            p.path.length > tmpBlk.volume.length &&
            path.startsWith(p.path)
          ) {
            tmpBlk.volume = p.path;
            tmpBlk.isPortable = !e.isSystem;
            if (tmpBlk.isPortable) {
              tmpBlk.description = e.description;
              tmpBlk.mountIndex = i;
              tmpBlk.partitions = e.mountpoints.length;
              tmpBlk.size = e.size;
            }
          }
        });
      });
      if (tmpBlk.volume.length) {
        let vid = tmpBlk.isPortable ?
          tmpBlk.description +
          "__" +
          tmpBlk.mountIndex +
          "__" +
          tmpBlk.partitions +
          "__" +
          tmpBlk.size :
          tmpBlk.volume;
        if (tmpBlk.isPortable) {
          delete tmpBlk["volume"];
        } else {
          delete tmpBlk["description"];
          delete tmpBlk["mountIndex"];
          delete tmpBlk["partitions"];
          delete tmpBlk["size"];
        }
        tmpBlk.uuid = md5(vid)
        let p = path.slice(tmpBlk.volume.length)
        tmpBlk.directories = [{
          path: p,
          uuid: md5(vid + p)
        }];
        cbk(tmpBlk);
      }
    });
}

function crossProduct() {
  return _.reduce(arguments, (a, b) => _.flatten(_.map(a, x => _.map(b, y => x.concat(y))), true), [""])
}

function crossArrProduct(arr) {
  return crossProduct.call(this, ...arr)
}

function splitChinese(hans) {
  if (typeof hans !== "string") {
    return [];
  }

  let pys = [];
  let nohans = "";

  for (let i = 0, words, l = hans.length; i < l; i++) {

    words = hans[i];

    let dict = pinyin(words, {
      heteronym: true,
      style: pinyin.STYLE_NORMAL
    });
    if (dict.length === 1 && dict[0][0] != words) {

      // ends of non-chinese words.
      if (nohans.length > 0) {
        pys.push([nohans]);
        nohans = ""; // reset non-chinese words.
      }

      pys.push([words, ..._.flatten(dict)]);
    } else {
      nohans += words;
    }
  }
  if (nohans.length > 0) {
    pys.push([nohans]);
  }

  return pys
}

function safeURI(path) {
  return fileURL(path)
}

function formatBytes(a, b) {
  if (0 == a) return "0 Bytes";
  var c = 1024,
    d = b || 2,
    e = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
    f = Math.floor(Math.log(a) / Math.log(c));
  return parseFloat((a / Math.pow(c, f)).toFixed(d)) + " " + e[f];
}

function iAmDouban(url) {
  return axios.get(url + '?app_version=5.0.0&apikey=054022eaeae0b00e0fc068c0c0a2102a&appid=wx2f9b06c1de1ccfca', {
    headers: {
      'X-Rewrite': JSON.stringify({
        Host: 'm.douban.com',
        Referer: 'https://servicewechat.com/wx2f9b06c1de1ccfca/8/page-frame.html',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E302 MicroMessenger/6.6.7 NetType/4G Language/zh_CN'
      })
    }
  }).catch(e => console.error(e))
}

export default {
  crossProduct,
  crossArrProduct,
  splitChinese,
  parse2ConfigFormat,
  copyObj,
  safeURI,
  formatBytes,
  iAmDouban,
  parseUSB2Vol
}