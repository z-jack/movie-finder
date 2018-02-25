<template>
  <Layout>
    <Layout>
      <Sider hide-trigger :width="240" class="root-sider">
        <Input icon="ios-search" placeholder="在此页面搜索..." style="width: 100%" @on-change="searchUpdate" @on-focus="activeSearch" @on-blur="deactiveSearch"></Input>
        <Menu :theme="app_config.theme || 'light'" mode="vertical" @on-select="menuNavi" :active-name="activeName || 'index'">
          <MenuItem name="index" ><Icon type="ios-home-outline"></Icon>首页</MenuItem>
          <MenuItem name="settings"><Icon type="ios-toggle-outline"></Icon>设置</MenuItem>
        </Menu>
      </Sider>
      <Content class="root-content">
        <router-view></router-view>
      </Content>
    </Layout>
    <Footer style="text-align:center">Copyright © 2015-2018 jackz.cn All Rights Reserved.</Footer>
    <core-sev></core-sev>
  </Layout>
</template>

<script>
import { mapState, mapActions } from "vuex";
import coreSev from "./components/CoreService.vue";

export default {
  name: "main-layout",
  data() {
    return {
      activeName: null
    };
  },
  computed: {
    ...mapState({
      app_config: state => state.Config.app_config
    })
  },
  methods: {
    menuNavi(item) {
      this.$router.push("/" + item);
    },
    searchUpdate(e) {
      this.setSearchContent(e.target.value);
    },
    ...mapActions([
      "activeSearch",
      "deactiveSearch",
      "toggleSearch",
      "setSearchContent"
    ])
  },
  mounted() {
    this.$set(this, "activeName", this.$route.path.slice(1));
  },
  components: {
    coreSev
  }
};
</script>

<style lang="scss">
.root-sider {
  position: fixed;
  left: 0;
  top: 0;
  overflow: hidden;
  background: #fff;
  height: calc(100vh - 69px);
}

.root-content {
  padding: 12px;
  margin-left: 240px;
  height: calc(100vh - 69px);
  overflow: auto;
}
</style>

