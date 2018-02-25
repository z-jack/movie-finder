const state = {
    search_isActive: false,
    search_content: ""
}

const mutations = {
    ACTIVE(state) {
        state.search_isActive = true
    },
    DEACTIVE(state) {
        state.search_isActive = false
    },
    TOGGLE(state) {
        state.search_isActive = !state.search_isActive
    },
    SET_CONTENT(state, msg) {
        state.search_content = msg
    }
}

const actions = {
    activeSearch({ commit }) {
        commit('ACTIVE')
    },
    deactiveSearch({ commit }) {
        commit('DEACTIVE')
    },
    toggleSearch({ commit }) {
        commit('TOGGLE')
    },
    setSearchContent({ commit }, msg) {
        commit('SET_CONTENT', msg)
    }
}

export default {
    state,
    mutations,
    actions
}
