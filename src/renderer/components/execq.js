import { exec } from "child_process"

class execq {
    constructor() {
        this.queue = []
        this.running = false
    }

    get length() {
        return this.queue.length
    }

    push() {
        let arg = [].slice.call(arguments);
        if (this.running)
            this.queue.push(arg)
        else
            this.__invoke(arg)
    }

    exists(f) {
        if (f instanceof Function) {
            return !!this.queue.find(v => f(v));
        }
        return false
    }

    __invoke(arg) {
        this.running = true
        let cbk = arg.slice(-1)[0]
        if (cbk instanceof Function) {
            arg.splice(-1, 1, (err, stdout, stderr) => {
                this.__finish()
                cbk(err, stdout, stderr)
            })
        } else {
            arg.push((err, stdout, stderr) => {
                this.__finish()
            })
        }
        exec.call(null, ...arg)
    }

    __finish() {
        if (this.queue.length) {
            this.__invoke(this.queue.shift())
        } else
            this.running = false
    }
}

export default execq