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
import execQ from "./execq";
const { app } = require("electron").remote;
const exec = promisify(require("child_process").exec);

export default {
  name: "core-service",
  data() {
    return {
      eQ: null,
      analysed: []
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
      handler: function () {
        if (window.process.env.NODE_ENV !== "development") {
          let dir = path.join(app.getPath("userData"), "app_config.json");
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
    async analyseDirectory(dir, flag) {
      if (this.analysed.indexOf(dir) < 0 || flag) {
        const msg = this.$Message.loading({
          content: "正在分析目录结构...",
          duration: 0
        });
        await this.ffSupportSDK();
        let files = fs.readdirSync(dir);
        if (this.app_config && !this.app_config.VF) {
          this.setByKeyValue(["VF", utils.copyObj(this.defext)]);
        }
        utils.parse2ConfigFormat(dir, async conf => {
          let newconf = utils.copyObj(this.app_config);
          let vid = conf.isPortable
            ? conf.description +
            "__" +
            conf.mountIndex +
            "__" +
            conf.partitions +
            "__" +
            conf.size
            : conf.volume;
          let pid = vid + conf.directories[0].path
          if (!newconf.files) newconf.files = []
          if (!newconf.locates) newconf.locates = []
          if (!newconf.binds) newconf.binds = []
          for (let i = 0; i < files.length; i++) {
            let f = files[i];
            try {
              let s = await promisify(fs.stat)(path.join(dir, f));
              if (s.isFile()) {
                let file = path.join(dir, f);
                if (
                  this.app_config.VF.indexOf(
                    this.exts.indexOf(path.extname(file).toLowerCase())
                  ) >= 0
                ) {
                  let fid = pid + f
                  let uuid = md5(fid)
                  if (newconf.files.find(x => x.uuid == uuid)) continue;
                  let fdes = {
                    fileName: f,
                    nameSlice: utils.splitChinese(
                      path.basename(f, path.extname(f).toLowerCase())
                    ),
                    hasViewed: false,
                    uuid: uuid
                  };
                  this.generateThumb(dir, fdes);
                  newconf.files.push(fdes);
                  newconf.locates.push({
                    vid: md5(vid),
                    pid: md5(pid),
                    fid: uuid
                  })
                }
              }
            } catch (_) { }
          }
          newconf.files = newconf.files.filter(x => {
            let floc = newconf.locates.filter(y => y.fid == x.uuid)
            if (floc.length != 1) return false
            if (floc[0].vid != conf.uuid || floc[0].pid != conf.directories[0].uuid) return true
            return fs.existsSync(path.join(dir, x.fileName))
          }).filter(
            x =>
              this.app_config.VF.indexOf(
                this.exts.indexOf(path.extname(x.fileName).toLowerCase())
              ) >= 0
          );
          this.analysed.push(dir);
          this.setConfig(newconf);
          msg();
        });
      }
    },
    removedDirectory(dir) {
      let d = this.analysed.indexOf(dir)
      if (d >= 0) {
        this.analysed.splice(d, 1)
      }
    },
    migrateFromV1(cfg) {
      let v2 = utils.copyObj(cfg);
      v2.version = '2.0'
      delete v2.volumes
      v2.volumes = cfg.volumes.map(x => {
        let uuid = x.isPortable
          ? x.description +
          "__" +
          x.mountIndex +
          "__" +
          x.partitions +
          "__" +
          x.size
          : x.volume
        let dirs = x.directories.map(y => {
          return {
            path: y.path,
            uuid: md5(uuid + y.path)
          }
        })
        return x.isPortable ? {
          isPortable: true,
          description: x.description,
          mountIndex: x.mountIndex,
          partitions: x.partitions,
          size: x.size,
          uuid: md5(uuid),
          directories: dirs
        } : {
            isPortable: false,
            volume: x.volume,
            uuid: md5(uuid),
            directories: dirs
          }
      })
      v2.files = []
      v2.locates = []
      v2.binds = []
      cfg.volumes.forEach(x => {
        x.directories.forEach(y => {
          y.files.forEach(z => {
            let uuid = x.isPortable
              ? x.description +
              "__" +
              x.mountIndex +
              "__" +
              x.partitions +
              "__" +
              x.size
              : x.volume
            v2.files.push({
              uuid: z.md5,
              fileName: z.fileName,
              nameSlice: z.nameSlice,
              hasViewed: z.hasViewed
            })
            v2.locates.push({
              vid: md5(uuid),
              pid: md5(uuid + y.path),
              fid: z.md5
            })
          })
        })
      })
      return v2
    },
    markAll(flag) {
      let newconf = utils.copyObj(this.app_config);
      newconf.files.forEach(f => {
        f.hasViewed = !!+flag;
      });
      this.setConfig(newconf);
    },
    pathVal(p) {
      if (typeof p !== 'string') return false
      return path.isAbsolute(p)
    },
    generateThumb(dir, fdes, d) {
      if (typeof fdes === "string") {
        fdes = JSON.parse(fdes);
        d = true;
      }
      let thumbdir = path.join(app.getPath("userData"), "thumbs");
      if (!fs.existsSync(thumbdir)) fs.mkdirSync(thumbdir);
      let input = path.join(dir, fdes.fileName);
      let output = path.join(thumbdir, fdes.uuid + ".jpg");
      if (fs.existsSync(output)) {
        d && this.emit("refreshThumb:" + fdes.uuid);
        return;
      }
      if (!this.eQ) {
        let q = new execQ();
        this.$set(this, "eQ", q);
      }
      if (this.eQ.exists(x => x[0].includes(output))) return;
      if (
        this.pathVal(this.app_config.ffmpeg) &&
        this.pathVal(input) &&
        this.pathVal(output) &&
        fs.existsSync(this.app_config.ffmpeg)
      )
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
            this.emit("refreshThumb:" + fdes.uuid);
          }
        );
    },
    async ffSupportSDK() {
      if (
        this.app_config &&
        this.app_config.ffmpeg &&
        this.pathVal(this.app_config.ffmpeg) &&
        fs.existsSync(this.app_config.ffmpeg)
      )
        return;
      let dest = path.join(app.getPath("userData"), "ffmpeg");
      if (!fs.existsSync(dest)) fs.mkdirSync(dest);
      if (!fs.existsSync(path.join(
        dest,
        ffbinaries.getBinaryFilename("ffmpeg", ffbinaries.detectPlatform())
      ))) {
        try {
          await promisify(ffbinaries.downloadFiles)(["ffmpeg"], {
            platform: ffbinaries.detectPlatform(),
            quiet: true,
            destination: dest
          });
        } catch (_) {
          return
        }
      }
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
      let dir = path.join(app.getPath("userData"), "app_config.json");
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
            if (cfg.version != '2.0') {
              cfg = this.migrateFromV1(cfg)
            }
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
