<template>
  <div>
    <Select v-model="selpath" style="width:calc(100% - 80px)">
      <Option value="all">全部视频文件</Option>
      <OptionGroup v-for="volume in volumes" :key="volume.volume" :label="volume.volume">
        <Option :value="volume.volume + '@root$all'">此盘全部视频</Option>
        <Option v-for="dir in volume.directories" :key="dir.path" :value="volume.volume + dir.path" class="overflow-option">{{ dir.path ? dir.path : '/' }}</Option>
      </OptionGroup>
    </Select>
    <Button type="ghost" shape="circle" icon="ios-plus-empty" @click="addPath"></Button>
    <Button :type="onlyV ? 'info' : 'ghost'" shape="circle" icon="ios-glasses-outline" @click="onlyV = !onlyV"></Button>
    <Page v-if="filteredItem.length>40" :total="filteredItem.length" :page-size="40" @on-change="page=$event" style="text-align:center;margin-top:20px;margin-bottom:10px" :current="page"></Page>
    <waterfall line='h' :line-gap="200" :min-line-gap="180" :max-line-gap="220">
      <waterfall-slot
        v-for="(item, index) in filteredItem.slice((page-1)*40,page*40)"
        :width="400"
        :height="300"
        :order="index"
        :key="item.md5" class="thumbshow" style="padding:10px">
        <template v-if="item.image">
          <div class="thumbview" :style="{'background-image': 'url('+ item.image +')'}" @click="openFile(item)"></div>
        </template>
        <template v-else>
          <div class="thumbload" @click="openFile(item)">
            正在生成缩略图
          </div>
        </template>
        <div class="thumbinfo">
          <div class="namectner">
            <p @click="openFile(item)">{{ item.base }}</p>
          </div>
          <div class="btngroup">
            <Button type="ghost" shape="circle" :icon="item.hasViewed ? 'ios-checkmark-empty' : 'ios-glasses-outline'" @click="toggleItem(item)"></Button><Button type="ghost" shape="circle" icon="ios-more" @click="navi('detail-page', {type:'ijump', item})"></Button>
          </div>
        </div>
      </waterfall-slot>
    </waterfall>
    <Page v-if="filteredItem.length>40" :total="filteredItem.length" :page-size="40" @on-change="page=$event" style="text-align:center;margin-top:20px" :current="page"></Page>
  </div>
</template>

<script>
import { mapState, mapActions } from "vuex";
import driveList from "drivelist";
import path from "path";
import fs from "fs";
import utils from "./utils";
import pinyin from "pinyin";
import fuzzy from "fuzzy";
import { shell } from "electron";
import Waterfall from "vue-waterfall/lib/waterfall";
import WaterfallSlot from "vue-waterfall/lib/waterfall-slot";
const { app } = require("electron").remote;
const { dialog, BrowserWindow } = require("electron").remote;

export default {
  name: "index-page",
  data() {
    return {
      selpath: "all",
      refdig: 0,
      onlyV: false,
      page: 1
    };
  },
  asyncComputed: {
    async volumes() {
      if (!this.app_config.volumes) return [];
      let volumes = [];
      await this.app_config.volumes.forEach(async element => {
        if (element.isPortable) {
          let dev = await utils.parseUSB2Vol(
            element.description,
            element.mountIndex,
            element.partitions,
            element.size
          );
          if (!dev.length) return;
          let volume = dev[0];
          if (!volumes.includes(volume))
            volumes.push({
              volume,
              directories: element.directories,
              uuid: element.uuid
            });
          else
            volumes
              .find(x => x.volume == volume)
              .directories.push(...element.directories);
          this.invokeAnalyseVolume(element.directories, volume);
        } else {
          if (!volumes.includes(element.volume)) volumes.push(element);
          else
            volumes
              .find(x => x.volume == element.volume)
              .directories.push(...element.directories);
          this.invokeAnalyseVolume(element.directories, element.volume);
        }
      });
      return volumes;
    }
  },
  computed: {
    totalItem() {
      let flist = [];
      let refdig = this.refdig;
      if (!this.volumes) return [];
      if (!this.app_config.files) return [];
      this.app_config.files.forEach(f => {
        let floc = this.app_config.locates.find(x => x.fid == f.uuid)
        let v = this.volumes.find(x => x.uuid == floc.vid)
        if (!v) return
        let fblk = utils.copyObj(f);
        let d = v.directories.find(x => x.uuid == floc.pid)
        fblk.volume = v.volume;
        fblk.pk = v.volume + d.path;
        fblk.base = path.basename(f.fileName, path.extname(f.fileName));
        if (this.app_config.binds) {
          let fbind = this.app_config.binds.find(x => x.fid == f.uuid)
          if (fbind) {
            fblk.douid = fbind.did
          }
        }
        let p = path.join(
          app.getPath("userData"),
          "thumbs",
          f.uuid + ".jpg"
        );
        if (fs.existsSync(p)) {
          fblk.image = utils.safeURI(p);
        } else {
          this.invoke("generateThumb", fblk.pk, JSON.stringify(f));
        }
        flist.push(fblk);
      });
      return flist;
    },
    filteredItem() {
      return (() => {
        if (this.selpath == "all") return this.totalItem;
        if (this.selpath.endsWith("@root$all"))
          return this.totalItem.filter(
            x => x.volume == this.selpath.slice(0, -9)
          );
        return this.totalItem.filter(x => x.pk == this.selpath);
      })()
        .filter(x => !this.onlyV || !x.hasViewed)
        .sort((i, j) => pinyin.compare(i.base, j.base))
        .map((x, i, a) => {
          if (this.search_content) {
            let slice = utils.crossArrProduct(x.nameSlice);
            return {
              block: x,
              fuzzy: fuzzy.filter(this.search_content, slice).map(y => {
                return {
                  x_index: y.original.indexOf(this.search_content[0]),
                  ...y
                }
              })
            };
          } else
            return {
              block: x,
              fuzzy: [{ score: a.length - i, x_index: i }]
            };
        })
        .filter(x => x.fuzzy.length > 0)
        .sort((i, j) => j.fuzzy[0].score - i.fuzzy[0].score || i.fuzzy[0].x_index - j.fuzzy[0].x_index)
        .map(x => x.block);
    },
    ...mapState({
      app_config: s => s.Config.app_config,
      event: s => s.Events.event,
      search_content: s => s.SearchBar.search_content
    })
  },
  methods: {
    invoke() {
      let arg = [].slice.call(arguments);
      arg = arg.map(x => encodeURIComponent(x));
      this.emit(arg.join(":"));
    },
    async invokeAnalyseVolume(dirs, volume) {
      await true;
      dirs.forEach(dir => {
        this.invokeAnalyseDir(volume + dir.path);
      });
    },
    invokeAnalyseDir(dir) {
      if (!dir) return;
      this.invoke("analyseDirectory", dir);
    },
    addPath() {
      let dir = dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
        title: "选择要添加的视频文件夹",
        properties: ["openDirectory", "createDirectory"]
      });
      dir &&
        utils.parse2ConfigFormat(dir[0], conf => {
          let newconf = utils.copyObj(this.app_config);
          let embedded = false;
          let hashad = false;
          if (!newconf.volumes) {
            newconf.volumes = [];
          }
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
              embedded = true;
              if (x.directories.find(x => x.path == conf.directories[0].path)) {
                hashad = true;
                return;
              }
              x.directories.push(...conf.directories);
              this.invokeAnalyseDir(dir[0]);
            }
          });
          if (!embedded) newconf.volumes.push(conf);
          if (!hashad) this.setConfig(newconf);
        });
    },
    openDirectory(fb) {
      shell.showItemInFolder(path.join(fb.pk, fb.fileName));
    },
    openFile(fb) {
      shell.openItem(path.join(fb.pk, fb.fileName));
    },
    refreshThumb() {
      this.$set(this, "refdig", this.refdig + 1);
    },
    toggleItem(fb) {
      let f = this.app_config.files.find(x => x.uuid == fb.uuid);
      if (f) {
        let k = this.app_config.files.indexOf(f)
        this.setByPath([
          ['files', k, 'hasViewed'],
          !fb.hasViewed
        ])
      }
    },
    navi(name, params) {
      if (params === undefined)
        this.$router.push(`/${name}`);
      else
        this.$router.push({
          name,
          params
        })
    },
    ...mapActions(["setConfig", "emit", "setByPath", "handle"])
  },
  watch: {
    event() {
      let evt = this.event;
      let msg = this.event.split(":");
      msg = msg.map(x => decodeURIComponent(x));
      if (this[msg[0]] instanceof Function) {
        let res = this[msg[0]].call(this, ...msg.slice(1));
        if (res instanceof Promise) res.then(v => this.handle(evt));
        else this.handle(evt);
      }
    },
    page() {
      this.$el.parentElement.scrollTop = 0;
    },
    search_content() {
      this.$set(this, "page", 1);
    },
    onlyV() {
      this.$set(this, "page", 1);
    }
  },
  components: {
    Waterfall,
    WaterfallSlot
  }
};
</script>

<style lang="scss">
.overflow-option {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  direction: rtl;
  text-align: left;
}

.thumbshow {
  padding: 10px;
  transition: 0.3s ease-in-out;

  &:hover {
    background: rgba(128, 132, 143, 0.3);
  }

  .thumbview {
    width: 100%;
    height: 75%;
    background-size: cover;
    background-position: center center;
    cursor: pointer;
  }

  .thumbload {
    width: 100%;
    height: 75%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    background: #bbbec4;
  }

  .thumbinfo {
    width: 100%;
    height: 25%;

    .namectner {
      display: flex;
      justify-content: left;
      align-items: center;
      float: left;
      width: 62.5%;
      height: 100%;

      p {
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: left;
        cursor: pointer;
      }
    }

    .btngroup {
      float: right;
      width: 37.5%;
      height: 100%;
      margin: 0;

      .ivu-btn.ivu-btn-circle.ivu-btn-icon-only {
        width: 40%;
        height: 0;
        padding-top: 40%;
        margin: 4%;
        font-size: width;
        position: relative;

        .ivu-icon {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
        }
      }
    }
  }
}
</style>

