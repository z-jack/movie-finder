<template>
</template>

<script>
import { mapActions, mapState } from "vuex";
import fs from "fs";
import path from "path";
import ffbinaries from "ffbinaries";
import { promisify } from "util";
import utils from "./utils";
import md5 from "md5";
import pathVal from "is-valid-path";
import execQ from "./execq";
const exec = promisify(require("child_process").exec);

export default {
  name: "core-service",
  data() {
    return {
      eQ: null
    };
  },
  computed: {
    ...mapState({
      app_config: s => s.Config.app_config,
      event: s => s.Events.event,
      exts: s => s.Const.videoFileExt,
      defext: s => s.Const.defaultVF
    })
  },
  watch: {
    app_config: {
      handler: function() {
        if (window.process.env.NODE_ENV !== "development") {
          let dir = path.join(window.process.cwd(), "app_config.json");
          fs.open(dir, "w", (err, fd) => {
            if (err) {
              console.error(err);
              return;
            }
            fs.write(
              fd,
              JSON.stringify(this.app_config),
              0,
              "utf8",
              (err, written, str) => {
                fs.close(fd);
              }
            );
          });
        }
      },
      deep: true
    },
    event() {
      let evt = this.event;
      let msg = this.event.split(":");
      msg = msg.map(x => decodeURIComponent(x));
      if (this[msg[0]] instanceof Function) {
        let res = this[msg[0]].call(this, ...msg.slice(1));
        if (res instanceof Promise) res.then(v => this.handle(evt));
        else this.handle(evt);
      }
    }
  },
  methods: {
    async analyseDirectory(dir) {
      await this.ffSupportSDK();
      let files = fs.readdirSync(dir);
      if (this.app_config && !this.app_config.VF) {
        this.setByKeyValue(["VF", utils.copyObj(this.defext)]);
      }
      utils.parse2ConfigFormat(dir, async conf => {
        let fprops = [];
        let embedded = false;
        let newconf = utils.copyObj(this.app_config);
        let dirref = null;
        newconf.volumes.forEach(x => {
          if (
            !embedded &&
            x.isPortable == conf.isPortable &&
            (x.isPortable
              ? x.description == conf.description &&
                x.mountIndex == conf.mountIndex &&
                x.partitions == conf.partitions &&
                x.size == conf.size
              : x.volume == conf.volume)
          ) {
            let b = x.directories.find(x => x.path == conf.directories[0].path);
            if (b) {
              embedded = true;
              fprops = b.files;
              dirref = b;
            }
          }
        });
        for (let i = 0; i < files.length; i++) {
          let f = files[i];
          try {
            let s = await promisify(fs.stat)(path.join(dir, f));
            if (s.isFile()) {
              let file = path.join(dir, f);
              if (
                this.app_config.VF.indexOf(
                  this.exts.indexOf(path.extname(file))
                ) >= 0
              ) {
                if (fprops.find(x => x.fileName == f)) return;
                let uuid = conf.isPortable
                  ? conf.description +
                    "__" +
                    conf.mountIndex +
                    "__" +
                    conf.partitions +
                    "__" +
                    conf.size
                  : conf.volume;
                uuid += conf.directories[0].path + f;
                let fdes = {
                  fileName: f,
                  nameSlice: utils.splitChinese(
                    path.basename(f, path.extname(f))
                  ),
                  hasViewed: false,
                  md5: md5(uuid)
                };
                this.generateThumb(dir, fdes);
                fprops.push(fdes);
              }
            }
          } catch (_) {}
        }
        if (dirref)
          dirref.files = fprops
            .filter(x => fs.existsSync(path.join(dir, x.fileName)))
            .filter(
              x =>
                this.app_config.VF.indexOf(
                  this.exts.indexOf(path.extname(x.fileName))
                ) >= 0
            );
        this.setConfig(newconf);
      });
    },
    markAll(flag) {
      let newconf = utils.copyObj(this.app_config);
      newconf.volumes.forEach(v => {
        v.directories.forEach(d => {
          d.files.forEach(f => {
            f.hasViewed = !!+flag;
          });
        });
      });
      this.setConfig(newconf);
    },
    generateThumb(dir, fdes, d) {
      if (typeof fdes === "string") {
        fdes = JSON.parse(fdes);
        d = true;
      }
      let thumbdir = path.join(window.process.cwd(), "thumbs");
      if (!fs.existsSync(thumbdir)) fs.mkdirSync(thumbdir);
      let input = path.join(dir, fdes.fileName);
      let output = path.join(thumbdir, fdes.md5 + ".jpg");
      if (fs.existsSync(output)) {
        d && this.emit("refreshThumb:" + fdes.md5);
        return;
      }
      if (!this.eQ) {
        let q = new execQ();
        this.$set(this, "eQ", q);
      }
      if (this.eQ.exists(x => x[0].includes(output))) return;
      if (pathVal(this.app_config.ffmpeg) && pathVal(input) && pathVal(output))
        this.eQ.push(
          this.app_config.ffmpeg +
            " -y -ss " +
            (Math.random() * 60 + 60) +
            ' -stream_loop -1 -i "' +
            input +
            '" -vf scale=400:-1 -vframes 1 -q:v 2 "' +
            output +
            '"',
          () => {
            this.emit("refreshThumb:" + fdes.md5);
          }
        );
    },
    async ffSupportSDK() {
      if (
        this.app_config &&
        this.app_config.ffmpeg &&
        pathVal(this.app_config.ffmpeg)
      )
        return;
      let dest = path.join(window.process.cwd(), "ffmpeg");
      if (!fs.existsSync(dest)) fs.mkdirSync(dest);
      await promisify(ffbinaries.downloadFiles)(
        ["ffmpeg"],
        {
          platform: ffbinaries.detectPlatform(),
          quiet: true,
          destination: dest
        }
      );
      this.setByKeyValue([
        "ffmpeg",
        path.join(
          dest,
          ffbinaries.getBinaryFilename("ffmpeg", ffbinaries.detectPlatform())
        )
      ]);
    },
    ...mapActions(["setConfig", "handle", "setByKeyValue", "emit"])
  },
  mounted() {
    console.log("core-service launched.");
    if (window.process.env.NODE_ENV !== "development") {
      let dir = path.join(window.process.cwd(), "app_config.json");
      if (!fs.existsSync(dir)) {
        fs.open(dir, "w+", (err, fd) => {
          if (err) {
            console.error(err);
            return;
          }
          fs.writeSync(fd, "{}");
          fs.close(fd);
        });
      } else
        fs.readFile(dir, "utf8", (err, data) => {
          if (err) {
            console.error(err);
            return;
          }
          try {
            let cfg = JSON.parse(data) || {};
            this.setConfig(cfg);
          } catch (e) {
            console.error(e);
            console.warn(data);
          }
        });
    }
  }
};
</script>
