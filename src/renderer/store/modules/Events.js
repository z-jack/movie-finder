const state = {
    event: 'null',
    handled: true
}

const mutations = {
    EMIT(state, cfg) {
        state.event = cfg
        state.handled = false
    },
    HANDLE(state) {
        state.handled = true
    }
}

const actions = {
    emit({ commit }, evt) {
        if (typeof (evt) == 'string')
            commit('EMIT', evt)
    },
    handle({ commit }, evt) {
        if (evt == state.event)
            commit('HANDLE')
    }
}

export default {
    state,
    mutations,
    actions
}
