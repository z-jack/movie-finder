<template>
  <div class="search-ctner">
    <h1>豆瓣推荐</h1>
    <Input @on-enter="search()" v-model="searchKey" class="search-input" icon="ios-search" placeholder="输入你想看的电影关键词..."></Input>
    <template v-if="searchRes">
      <div v-for="item in searchRes" class="search-res-card" @click="openMovie(item)">
        <div class="search-res-pic" :style="{backgroundImage:`url(${item.pic.large})`}"></div>
        <div class="search-res-info">
          <h2>{{item.title}}</h2>
          <p>{{item.card_subtitle}}</p>
        </div>
      </div>
    </template>
    <template v-else>
      <Card v-for="rec in recommandMovies" class="search-rec-card" v-if="recommandMoviesList && rec.type in recommandMoviesList && recommandMoviesList[rec.type].length > 0">
        <p slot="title">{{ rec.name }}</p>
        <div v-for="item in recommandMoviesList[rec.type]" class="search-rec-show" @click="openMovie(item)">
          <div class="search-rec-pic" :style="{backgroundImage:`url(${item.cover.url})`}"></div>
          <div class="search-rec-info">
            <p>{{item.title}}</p>
            <Rate disabled v-if="item.rating" show-text allow-half :value="item.rating.value / item.rating.max * 5">
              <span style="color: #f5a623">{{ item.rating.value }}</span>
            </Rate>
            <p class="search-rec-no-rate" v-else>暂无评分</p>
          </div>
        </div>
      </Card>
    </template>
  </div>
</template>

<script>
import axios from 'axios'
import { mapState, mapActions } from 'vuex';
import utils from './utils';

export default {
  name: 'search-page',
  data() {
    return {
      searchKey: '',
      searchRes: null,
      recommandMovies: [
        {
          name: '近期上映',
          type: 'movie_showing'
        },
        {
          name: '热门电影',
          type: 'movie_hot_gaia'
        },
        {
          name: '电视剧',
          type: 'tv_hot'
        },
        {
          name: '综艺',
          type: 'tv_variety_show'
        }
      ],
      cache_: {}
    }
  },
  computed: {
    ...mapState({
      server_host: s => s.Const.serverHost,
      tmp_config: s => s.Config.tmp_config
    })
  },
  asyncComputed: {
    async recommandMoviesList() {
      let list = {}
      await this.recommandMovies.forEach(async obj => {
        let data = await this.recommand(obj.type)
        list[obj.type] = data.subject_collection_items
      })
      return list
    }
  },
  methods: {
    search() {
      if (this.searchKey) {
        axios.get(`${this.server_host}/search?q=${encodeURIComponent(this.searchKey)}&type=movie&app_version=5.0.0`).then(v => {
          if (v.status === 200)
            this.$set(this, 'searchRes', v.data.subjects)
          else
            console.log(v)
        }).catch(e => {
          console.error(e)
        })
      } else {
        this.$set(this, 'searchRes', null)
      }
    },
    openMovie(item) {
      this.emit('djump:' + JSON.stringify(item))
    },
    async recommand(id) {
      if (`$rec_mov_${id}` in this.cache_)
        return this.cache_[`$rec_mov_${id}`]
      try {
        let d = await axios.get(`${this.server_host}/subject_collection/${id}/items?count=10&app_version=5.0.0`)
        if (d.status === 200) {
          this.$set(this.cache_, `$rec_mov_${id}`, d.data)
          return d.data
        }
        else
          console.log(d)
      }
      catch (e) {
        console.error(e)
      }
    },
    ...mapActions(['emit', 'saveToTmp'])
  },
  mounted() {
    this.$set(this, 'cache_', utils.copyObj(this.tmp_config.searchCache || {}))
  },
  beforeDestroy() {
    this.saveToTmp(['searchCache', utils.copyObj(this.cache_)])
  }
}
</script>

<style lang="scss">
.search-ctner {
  position: relative;

  .search-input {
    margin-bottom: 20px;
  }

  .search-res-card {
    cursor: pointer;
    padding: 10px;
    border-bottom: #9ea7b4 1px solid;
    transition: 0.2s ease-in-out;

    &:last-child {
      border-bottom: 0;
    }

    &:hover {
      background: rgba(0, 0, 0, 0.1);
    }

    .search-res-pic {
      width: 100px;
      height: 140px;
      background-size: cover;
      background-position: center;
      display: inline-block;
      vertical-align: middle;
    }

    .search-res-info {
      display: inline-block;
      vertical-align: middle;
    }
  }

  .search-rec-card {
    margin-bottom: 20px;
    white-space: nowrap;
    overflow-x: auto;

    .ivu-rate {
      font-size: 10px;

      .ivu-rate-star {
        margin-right: 2px;
      }

      .ivu-rate-text {
        margin-left: 2px;
      }
    }

    .search-rec-show {
      display: inline-block;
      text-align: center;
      padding: 0 10px;
      vertical-align: middle;
      cursor: pointer;
      transition: 0.2s ease-in-out;
      $total-width: 100px;

      &:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      .search-rec-pic {
        width: $total-width;
        height: 140px;
        background-size: cover;
        background-position: center;
      }

      p {
        width: $total-width;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .search-rec-no-rate {
        font-size: 12px;
        color: #bbbec4;
      }
    }
  }
}
</style>
