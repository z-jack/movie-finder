<template>
  <div class="detail-ctner">
    <div v-if="item || douitem">
      <Button type="ghost" @click="naviBack()" style="position:absolute;top:20px;left:20px;z-index:1;border:0">
        <Icon type="ios-arrow-back" size="50" color="#ffffff"></Icon>
      </Button>
      <div class="detail-poster-back" :style="{backgroundImage:`url(${douitem && douitem.pic.large || item.image})`}"></div>
      <div class="detail-poster" :class="item? 'detail-poster-can-play': ''" :style="{backgroundImage:`url(${douitem && douitem.pic.large || item.image})`, cursor: item?'pointer':'default'}" @click="openFile()"></div>
      <div class="detail-header">
        <div class="dark-side">
          <h1>{{ douitem && douitem.title || item.base }}<span v-if="douitem"> ({{ douitem.year }})</span></h1>
          <h2 v-if="douitem && douitem.original_title">{{ douitem.original_title }}</h2>
          <h3>{{ douitem && douitem.genres.join(' / ') }}</h3>
          <template v-if="douitem">
            <Tag type="border" style="cursor:default" v-for="item in douitem.tags">{{ item.name }}</Tag>
          </template>
        </div>
        <div class="white-side">
          <div v-if="item" class="bind">
            <p v-if="item.douid">已匹配豆瓣信息 
              <!-- <Tag color="red" @click="">解绑</Tag> -->
            </p>
            <p v-else>待匹配豆瓣信息 
              <Poptip title="选择对应电影" placement="bottom" @on-popper-show="searchMovie()">
                <Button type="success" size="small">绑定</Button>
                <div slot="content" class="detail-bind-ctner">
                  <template v-if="lazySearch">
                    <template v-if="lazySearch.subjects.length">
                      <div v-for="subject in lazySearch.subjects" class="detail-bind-card">
                        <div class="detail-bind-pic" :style="{backgroundImage: `url(${subject.pic.normal})`}"></div>
                        <div class="detail-bind-info">
                          <p>{{ subject.title }}</p>
                          <span>{{ subject.year }}</span>
                          <Button type="success" size="small" @click="bindMovie(subject)">选择</Button>
                        </div>
                      </div>
                    </template>
                    <p v-else style="text-align:center;padding-top:10px">未找到对应电影。</p>
                  </template>
                  <Spin fix v-else></Spin>
                </div>
              </Poptip>
            </p>
          </div>
          <div v-else-if="douitem" class="bind">
            <p>本信息来自：豆瓣网</p>
          </div>
          <Button @click="searchSrt()">搜索字幕</Button>
          <template v-if="item">
            <Button @click="openDirectory()">打开文件夹</Button>
            <Button @click="toggleItem(item)">标记为{{item.hasViewed? '未看': '已看'}}</Button>
          </template>
          <template v-if="douitem || item.douid">
            <Button @click="openDouban(douitem && douitem.id || item.douid)">豆瓣页面</Button>
          </template>
        </div>
      </div>
      <div class="detail-cards">
        <Card class="detail-card-disc" v-if="douitem">
          <p slot="title">剧情简介</p>
          <p>{{ douitem.intro }}</p>
        </Card>
        <Card class="detail-card-info">
          <p slot="title">电影信息</p>
          <template v-if="douitem">
            <p v-if="directors.length">导演： {{ serialize(uniqueInfo.directors) }}</p>
            <p v-if="editors.length">编剧： {{ serialize(uniqueInfo.editors) }}</p>
            <p>制片国家与地区： {{ serialize(douitem.countries) }}</p>
            <p>语言： {{ serialize(douitem.languages) }}</p>
            <p>上映日期： {{ serialize(douitem.pubdate) }}</p>
            <p>片长： {{ serialize(douitem.durations) }}</p>
            <p v-if="douitem.aka.length" style="user-select: initial;">又名： {{ serialize(douitem.aka.filter(x=>x !== douitem.title && x !== douitem.original_title)) }}</p>
            <p>豆瓣评分： <Rate v-if="douitem.rating" v-model="douitem.rating.value / douitem.rating.max * 5" allow-half disabled show-text>
              <span style="color: #f5a623">{{ douitem.rating.value }}</span>
            </Rate>
            <template v-else>
              暂无评分
            </template>
            </p>
          </template>
          <template v-else>
            <p>文件名： {{ item.fileName }}</p>
            <p>文件路径： {{ item.pk }}</p>
            <p>缩略图地址： {{ item.image }}</p>
          </template>
        </Card>
      </div>
      <Card class="detail-staffs" v-if="staffs.length">
        <p slot="title">演职人员</p>
        <div v-for="staff in staffs" class="detail-staff">
          <div class="detail-staff-portrait" :style="{backgroundImage:`url(${staff.avatar.large})`}"></div>
          <p>{{ staff.name }}</p>
          <p class="detail-staff-roles">{{ staff.roles.join(' / ') }}</p>
        </div>
      </Card>
    </div>
    <search v-else />
  </div>
</template>

<script>
import Search from './SearchPage'
import { shell, remote } from 'electron'
import { mapState, mapActions } from 'vuex';
import axios from 'axios'
import path from 'path'
import utils from './utils';

export default {
  name: 'detail-page',
  data() {
    return {
      item: null,
      douitem: null,
      lazySearch: null,
      intoType: null
    }
  },
  computed: {
    directors() {
      return this.douitem && this.douitem.directors.filter(s => s.roles.indexOf('导演') >= 0) || []
    },
    uniqueInfo() {
      let propList = ['directors', 'editors']
      let res = {}
      propList.forEach(p => {
        let unique = []
        this[p].forEach(s => {
          if (unique.filter(x => x.id !== s.id)) unique.push(s.name)
        })
        res[p] = unique
      })
      return res
    },
    editors() {
      return this.douitem && this.douitem.directors.concat(this.douitem.actors).filter(s => s.roles.indexOf('编剧') >= 0) || []
    },
    staffs() {
      return this.douitem && this.douitem.directors.concat(this.douitem.actors) || []
    },
    ...mapState({
      app_config: s => s.Config.app_config,
      event: s => s.Events.event,
      search_content: s => s.SearchBar.search_content,
      server_host: s => s.Const.serverHost
    })
  },
  methods: {
    searchSrt() {
      let title = this.item && this.item.base || this.douitem && this.douitem.title
      title && shell.openExternal(`http://assrt.net/sub/?searchword=${encodeURIComponent(title)}`)
    },
    openFile() {
      if (this.item)
        shell.openItem(path.join(this.item.pk, this.item.fileName));
    },
    openDouban(id) {
      shell.openExternal(`https://movie.douban.com/subject/${id}/`)
    },
    openDirectory() {
      shell.showItemInFolder(path.join(this.item.pk, this.item.fileName));
    },
    serialize(x) {
      if (typeof x === 'string') {
        return x.replace(/,/g, ' / ')
      } else if (x instanceof Array) {
        return x.join(' / ')
      }
      return x
    },
    toggleItem(fb) {
      let f = this.app_config.files.find(x => x.uuid == fb.uuid);
      if (f) {
        let k = this.app_config.files.indexOf(f)
        this.setByPath([
          ['files', k, 'hasViewed'],
          !fb.hasViewed
        ])
        this.$set(this.item, 'hasViewed', !fb.hasViewed)
      }
    },
    searchMovie() {
      if (this.lazySearch !== null) return
      axios.get(`${this.server_host}/search?q=${encodeURIComponent(this.item.base)}&type=movie&app_version=5.0.0`).then(v => {
        if (v.status === 200)
          this.$set(this, 'lazySearch', v.data)
        else
          console.log(v)
      }).catch(e => {
        console.error(e)
      })
    },
    bindMovie(item) {
      this.djump(item)
      this.$set(this.item, 'douid', item.id)
      let newconf = utils.copyObj(this.app_config)
      newconf.binds.push({
        fid: this.item.uuid,
        did: item.id
      })
      this.setConfig(newconf)
    },
    djump(item) {
      utils.iAmDouban(`${this.server_host}/${item.type}/${item.id}`).then(d => {
        if (d.status === 200)
          this.$set(this, 'douitem', d.data)
        else
          console.log(d)
      })
      this.emit('')
    },
    naviBack() {
      if (this.item) {
        this.$router.back()
      } else {
        this.$set(this, 'douitem', null)
        this.$set(this, 'item', null)
      }
    },
    ...mapActions(['emit', 'setConfig', 'setByPath'])
  },
  watch: {
    event(v) {
      if (v.startsWith('djump:')) {
        let j = v.slice(6)
        this.djump(JSON.parse(j))
      }
    },
    douitem(v) {
      if (v !== null && this.item === null) {
        if (!this.app_config.files) return
        let fbind = this.app_config.binds.find(x => x.did == v.id)
        if (fbind) {
          let f = utils.copyObj(this.app_config.files.find(x => x.uuid == fbind.fid))
          let floc = this.app_config.locates.find(x => x.fid == f.uuid)
          let rawVol = this.app_config.volumes.find(x => x.uuid == floc.vid)
          let pazh = rawVol.directories.find(x => x.uuid == floc.pid)
          if (rawVol.isPortable) {
            utils.parseUSB2Vol(rawVol.description,
              rawVol.mountIndex,
              rawVol.partitions,
              rawVol.size).then(dev => {
                if (!dev.length) return
                let volume = dev[0]
                f.volume = volume
                f.pk = volume + pazh.path
                this.$set(this, 'item', f)
              })
          }
        }
      }
    },
    item(v) {
      if (v !== null && this.douitem === null) {
        if (!v.douid) {
          let fbind = this.app_config.binds.find(x => x.fid == v.uuid)
          if (fbind) {
            v.douid = fbind.did
          }
        }
        if (v.douid) {
          utils.iAmDouban(`${this.server_host}/subject/${v.douid}`).then(d => {
            if (d.status === 200)
              this.djump({
                type: d.data.subtype,
                id: d.data.id
              })
            else
              console.log(d)
          })
        }
      }
    }
  },
  mounted() {
    if (this.$route.params.type === 'ijump') {
      this.$set(this, 'item', this.$route.params.item)
    } else if (this.$route.params.type === 'djump') {
      this.djump(this.$route.params.item)
    }
  },
  components: {
    Search
  }
}
</script>

<style lang="scss">
.detail-ctner {
  position: relative;
}

.detail-poster-back {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 350px;
  background-size: 110%;
  background-position: center 5%;
  filter: blur(4px) brightness(0.5);
  z-index: 0;
}

.detail-poster {
  position: relative;
  width: 270px;
  height: 380px;
  background-size: cover;
  background-position: center;
  top: 100px;
  margin: 0 5% 120px;
  display: inline-block;

  &-can-play {
    &:hover {
      &:before {
        position: absolute;
        width: 100%;
        height: 100%;
        left: 0;
        top: 0;
        background: rgba($color: #000000, $alpha: 0.3);
      }

      &:after {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 100px;
        content: "\F488";
        font-family: Ionicons;
        color: white;
      }
    }
  }
}

.detail-header {
  position: relative;
  display: inline-block;
  vertical-align: top;
  top: 150px;
  width: calc(90% - 280px);

  .dark-side {
    color: white;
    height: 220px;
    font-size: 18px;
    overflow: hidden;

    h1 span {
      color: #c3cbd6;
    }

    h3 {
      margin-top: 20px;
    }

    h1,
    h2 {
      user-select: all;
    }
  }

  .white-side {
    .bind {
      margin-bottom: 10px;
    }
  }
}

.detail-cards {
  display: flex;
  margin-bottom: 20px;

  .detail-card-disc {
    flex: 2;
    margin-right: 20px;
  }

  .detail-card-info {
    flex: 1;
  }
}

.detail-staffs {
  width: 100%;

  .ivu-card-body {
    white-space: nowrap;
    overflow-x: auto;
  }

  .detail-staff {
    display: inline-block;
    padding: 0 10px;
    text-align: center;
    $staff-width: 100px;

    .detail-staff-portrait {
      width: $staff-width;
      height: 140px;
      background-size: cover;
      background-position: center;
      margin: 0 auto;
    }

    p {
      width: $staff-width;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .detail-staff-roles {
      color: #9ea7b4;
      font-size: 0.8em;
    }
  }
}

.detail-bind-ctner {
  position: relative;
  width: 200px;
  min-height: 50px;
  max-height: 300px;

  .detail-bind-card {
    padding-bottom: 5px;
    margin-bottom: 5px;
    border-bottom: #9ea7b4 1px solid;

    &:last-child {
      border-bottom: 0;
    }

    .detail-bind-pic {
      width: 50px;
      height: 70px;
      background-size: cover;
      background-position: center;
      display: inline-block;
      vertical-align: middle;
    }

    .detail-bind-info {
      display: inline-block;
      vertical-align: middle;

      > span {
        display: block;
      }
    }
  }
}
</style>
