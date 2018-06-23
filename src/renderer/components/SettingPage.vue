<template>
  <div>
      <Form :label-width="100">
        <FormItem v-for="item in filteredSettings" :label="item.label" :key="item.label">
          <template v-if="item.type == 'checkbox'">
            <template v-if="item.allowSelectAll || item.resetDefault">
              <div style="border-bottom: 1px solid #e9e9e9;padding-bottom:6px;margin-bottom:6px;">
                <Checkbox :indeterminate="indeterminate(item.data, item.choices)" :value="checkAll(item.data, item.choices)" @click.prevent.native="handleCheckAll(item.data, item.choices, item)" v-if="item.allowSelectAll">全选</Checkbox>
                <Button type="warning" size="small" style="float:right" v-if="item.resetDefault" @click="resetCFG(item.resetDefault, item)">重设此项</Button>
              </div>
            </template>
            <CheckboxGroup v-model="item.data" @on-change="resetCFG($event, item)">
              <Checkbox v-for="(chs, idx) in item.choices" :label="idx" :key="chs">
                <span>{{ chs }}</span>
              </Checkbox>
            </CheckboxGroup>
          </template>
          <template v-else-if="item.type == 'button'">
            <Button v-for="btn in item.btns" :icon="btn.icon" :type="btn.type" :key="btn.label || btn.icon" :shape="btn.circle ? 'circle' : null"  :size="btn.size" @click="btn.handler(...(btn.arguments || []))" style="margin-right:10px">{{ btn.label }}</Button>
          </template>
          <template v-else-if="item.type == 'table'">
            <div style="display:flex">
              <Table :data="item.data" :columns="item.columns" :stripe='true' :highlight-row="item.allowSelect" :no-data-text="item.emptyDataText || '暂无数据'" style="flex-grow:1;min-width:0" @on-current-change="xTableSelect[item.label]=$event"></Table>
              <ButtonGroup vertical v-if="item.btns" style="margin-left:10px">
                <Button v-for="btn in item.btns" :icon="btn.icon" :type="btn.type" :key="btn.label || btn.icon" :shape="btn.circle ? 'circle' : null" :size="btn.size" @click="btn.handler(...(btn.arguments || []))">{{ btn.label }}</Button>
              </ButtonGroup>
            </div>
          </template>
        </FormItem>
      </Form>
  </div>
</template>

<script>
import { mapState, mapActions } from "vuex";
import utils from "./utils";
import fuzzy from "fuzzy";

export default {
  name: "setting-page",
  data() {
    return {
      xTableSelect: {}
    };
  },
  computed: {
    pathSummary() {
      let data = [];
      if (!this.app_config || !this.app_config.volumes) return [];
      this.app_config.volumes.forEach(v => {
        v.directories.forEach(d => {
          let block = {
            isPortable: v.isPortable,
            volume: v.volume,
            description: v.description,
            mountIndex: v.mountIndex,
            partitions: v.partitions,
            size: v.size,
            path: d.path || "/",
            vid: v.uuid,
            pid: d.uuid
          };
          if (block.isPortable)
            block.volume = `${block.description} (${block.mountIndex +
              1}号分区 / 共${block.partitions}个) - ${utils.formatBytes(
                block.size
              )}`;
          data.push(block);
        });
      });
      return data;
    },
    rawSettings() {
      return [
        {
          type: "checkbox",
          label: "检索的视频格式",
          nameSlice: [
            ["检", "jian"],
            ["索", "suo"],
            ["的", "de", "di"],
            ["视", "shi"],
            ["频", "pin"],
            ["格", "ge"],
            ["式", "shi"]
          ],
          allowSelectAll: true,
          resetDefault: this.defext,
          data: utils.copyObj(this.app_config.VF || this.defext),
          choices: this.exts,
          path: ["VF"]
        },
        {
          type: "button",
          label: "标记视频",
          nameSlice: [
            ["标", "biao"],
            ["记", "ji"],
            ["视", "shi"],
            ["频", "pin"]
          ],
          btns: [
            {
              label: "全部标记为已看",
              type: "primary",
              handler: this.emit,
              arguments: ["markAll:1"]
            },
            {
              label: "全部标记为待看",
              type: "primary",
              handler: this.emit,
              arguments: ["markAll:0"]
            }
          ]
        },
        {
          type: "table",
          label: "管理检索文件夹",
          nameSlice: [
            ["管", "guan"],
            ["理", "li"],
            ["检", "jian"],
            ["索", "suo"],
            ["文", "wen"],
            ["件", "jian"],
            ["夹", "jia", "ga"]
          ],
          allowSelect: true,
          emptyDataText: "暂无已索引文件夹",
          columns: [
            {
              title: "硬盘标识符",
              key: "volume"
            },
            {
              title: "文件夹路径",
              key: "path"
            }
          ],
          data: this.pathSummary,
          btns: [
            {
              icon: "ios-minus-empty",
              handler: this.delPath,
              arguments: ["管理检索文件夹"]
            }
          ]
        }
      ];
    },
    filteredSettings() {
      return this.rawSettings.filter(x => {
        let slice = utils.crossArrProduct(x.nameSlice);
        return fuzzy.filter(this.search_content, slice).length > 0;
      });
    },
    ...mapState({
      app_config: s => s.Config.app_config,
      search_content: s => s.SearchBar.search_content,
      exts: s => s.Const.videoFileExt,
      defext: s => s.Const.defaultVF
    })
  },
  methods: {
    indeterminate(d, a) {
      return !(d.length == a.length || d.length == 0);
    },
    checkAll(d, a) {
      return d.length == a.length;
    },
    handleCheckAll(d, a, i) {
      if (d.length == a.length) {
        this.resetCFG([], i);
      } else {
        this.resetCFG([...Array(a.length).keys()], i);
      }
    },
    delPath(sig) {
      let blk = this.xTableSelect[sig];
      let newconf = utils.copyObj(this.app_config);
      newconf.volumes.forEach(v => {
        v.directories = v.directories.filter(d => {
          return d.uuid != blk.pid
        });
      });
      let removeFiles = []
      newconf.files = newconf.files.filter(f => {
        let floc = newconf.locates.find(x => x.fid == f.uuid)
        if (floc.vid == blk.vid && floc.pid == blk.pid) {
          removeFiles.push(floc.fid)
        }
        return floc.vid != blk.vid || floc.pid != blk.pid
      })
      newconf.binds = newconf.binds.filter(x => removeFiles.indexOf(x) < 0)
      newconf.locates = newconf.locates.filter(x => x.vid != blk.vid || x.pid != blk.pid)
      newconf.volumes = newconf.volumes.filter(x => x.directories.length > 0)
      this.setConfig(newconf);
      let pazh = blk.path
      if (pazh == '/') pazh = ''
      if (blk.isPortable) {
        utils.parseUSB2Vol(blk.description,
          blk.mountIndex,
          blk.partitions,
          blk.size).then(dev => {
            if (!dev.length) return
            this.emit(`removedDirectory:${encodeURIComponent(dev[0] + pazh)}`)
          })
      } else {
        this.emit(`removedDirectory:${encodeURIComponent(blk.volume + pazh)}`)
      }
    },
    resetCFG(e, i) {
      this.setByPath([i.path, e]);
    },
    ...mapActions(["setByPath", "emit", "setConfig"])
  }
};
</script>

<style>
.ivu-btn > .ivu-icon + span:empty {
  margin-left: 0;
}
</style>
