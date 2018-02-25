import pinyin from "pinyin"
import driveList from "drivelist"
import _ from "underscore"
import fileURL from "file-url"

function copyObj(obj) {
  return JSON.parse(JSON.stringify(obj))
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
        tmpBlk.directories = [
          {
            path: path.slice(tmpBlk.volume.length),
            recursive: false,
            files: []
          }
        ];
        if (tmpBlk.isPortable) delete tmpBlk["volume"];
        else {
          delete tmpBlk["description"];
          delete tmpBlk["mountIndex"];
          delete tmpBlk["partitions"];
          delete tmpBlk["size"];
        }
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

    let dict = pinyin(words, { heteronym: true, style: pinyin.STYLE_NORMAL });
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

export default {
  crossProduct,
  crossArrProduct,
  splitChinese,
  parse2ConfigFormat,
  copyObj,
  safeURI,
  formatBytes
}