namespace fgui {
    export class Transition {
        public name: string;

        private _owner: GComponent;
        private _ownerBaseX: number;
        private _ownerBaseY: number;
        private _items: Array<TransitionItem>;
        private _totalTimes: number;
        private _totalTasks: number;
        private _playing: boolean;
        private _paused: boolean;
        private _onComplete: Laya.Handler;
        private _options: number;
        private _reversed: boolean;
        private _totalDuration: number;
        private _autoPlay: boolean;
        private _autoPlayTimes: number;
        private _autoPlayDelay: number;
        private _timeScale: number;
        private _startTime: number;
        private _endTime: number;

        private static OPTION_IGNORE_DISPLAY_CONTROLLER: number = 1;
        private static OPTION_AUTO_STOP_DISABLED: number = 2;
        private static OPTION_AUTO_STOP_AT_END: number = 4;

        constructor(owner: GComponent) {
            this._owner = owner;
            this._items = new Array<TransitionItem>();
            this._totalDuration = 0;
            this._autoPlayTimes = 1;
            this._autoPlayDelay = 0;
            this._timeScale = 1;
            this._startTime = 0;
            this._endTime = 0;
        }

        public play(onComplete: Laya.Handler = null,
            times: number = 1, delay: number = 0, startTime: number = 0, endTime: number = -1): void {
            this._play(onComplete, times, delay, startTime, endTime, false);
        }

        public playReverse(onComplete: Laya.Handler = null,
            times: number = 1, delay: number = 0, startTime: number = 0, endTime: number = -1): void {
            this._play(onComplete, 1, delay, startTime, endTime, true);
        }


        public changePlayTimes(value: number): void {
            this._totalTimes = value;
        }

        public setAutoPlay(value: boolean, times: number = 1, delay: number = 0): void {
            if (this._autoPlay != value) {
                this._autoPlay = value;
                this._autoPlayTimes = times;
                this._autoPlayDelay = delay;

                if (this._autoPlay) {
                    if (this._owner.onStage)
                        this.play(null, null, this._autoPlayTimes, this._autoPlayDelay);
                }
                else {
                    if (!this._owner.onStage)
                        this.stop(false, true);
                }
            }
        }

        private _play(onComplete: Laya.Handler = null,
            times: number = 1, delay: number = 0, startTime: number = 0, endTime: number = -1,
            reversed: boolean = false): void {
            this.stop(true, true);

            this._totalTimes = times;
            this._reversed = reversed;
            this._startTime = startTime;
            this._endTime = endTime;
            this._playing = true;
            this._paused = false;
            this._onComplete = onComplete;

            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                if (item.target == null) {
                    if (item.targetId)
                        item.target = this._owner.getChildById(item.targetId);
                    else
                        item.target = this._owner;
                }
                else if (item.target != this._owner && item.target.parent != this._owner)
                    item.target = null;

                if (item.target != null && item.type == TransitionActionType.Transition) {
                    var trans: Transition = (<GComponent>item.target).getTransition(item.value.transName);
                    if (trans == this)
                        trans = null;
                    if (trans != null) {
                        if (item.value.playTimes == 0) //this.stop
                        {
                            var j: number;
                            for (j = i - 1; j >= 0; j--) {
                                var item2: TransitionItem = this._items[j];
                                if (item2.type == TransitionActionType.Transition) {
                                    if (item2.value.trans == trans) {
                                        item2.value.stopTime = item.time - item2.time;
                                        break;
                                    }
                                }
                            }
                            if (j < 0)
                                item.value.stopTime = 0;
                            else
                                trans = null;//no need to handle this.stop anymore
                        }
                        else
                            item.value.stopTime = -1;
                    }
                    item.value.trans = trans;
                }
            }

            if (delay == 0)
                this.onDelayedPlay();
            else
                GTween.delayedCall(delay).onComplete(this.onDelayedPlay, this);
        }

        public stop(setToComplete: boolean = true, processCallback: boolean = false): void {
            if (!this._playing)
                return;

            this._playing = false;
            this._totalTasks = 0;
            this._totalTimes = 0;
            var handler: Laya.Handler = this._onComplete;
            this._onComplete = null;

            GTween.kill(this);//delay start

            var cnt: number = this._items.length;
            if (this._reversed) {
                for (var i: number = cnt - 1; i >= 0; i--) {
                    var item: TransitionItem = this._items[i];
                    if (item.target == null)
                        continue;

                    this.stopItem(item, setToComplete);
                }
            }
            else {
                for (i = 0; i < cnt; i++) {
                    item = this._items[i];
                    if (item.target == null)
                        continue;

                    this.stopItem(item, setToComplete);
                }
            }

            if (processCallback && handler != null) {
                handler.run();
            }
        }

        private stopItem(item: TransitionItem, setToComplete: boolean): void {
            if (item.displayLockToken != 0) {
                item.target.releaseDisplayLock(item.displayLockToken);
                item.displayLockToken = 0;
            }

            if (item.tweener != null) {
                item.tweener.kill(setToComplete);
                item.tweener = null;

                if (item.type == TransitionActionType.Shake && !setToComplete) //震动必须归位，否则下次就越震越远了。
                {
                    item.target._gearLocked = true;
                    item.target.setXY(item.target.x - item.value.lastOffsetX, item.target.y - item.value.lastOffsetY);
                    item.target._gearLocked = false;
                }
            }

            if (item.type == TransitionActionType.Transition) {
                var trans: Transition = item.value.trans;
                if (trans != null)
                    trans.stop(setToComplete, false);
            }
        }

        public setPaused(paused: boolean): void {
            if (!this._playing || this._paused == paused)
                return;

            this._paused = paused;
            var tweener: GTweener = GTween.getTween(this);
            if (tweener != null)
                tweener.setPaused(paused);

            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                if (item.target == null)
                    continue;

                if (item.type == TransitionActionType.Transition) {
                    if (item.value.trans != null)
                        item.value.trans.setPaused(paused);
                }
                else if (item.type == TransitionActionType.Animation) {
                    if (paused) {
                        item.value.flag = item.target.getProp(ObjectPropID.Playing);
                        item.target.setProp(ObjectPropID.Playing, false);
                    }
                    else
                        item.target.setProp(ObjectPropID.Playing, item.value.flag);
                }

                if (item.tweener != null)
                    item.tweener.setPaused(paused);
            }
        }

        public dispose(): void {
            if (this._playing)
                GTween.kill(this);//delay start

            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                if (item.tweener != null) {
                    item.tweener.kill();
                    item.tweener = null;
                }

                item.target = null;
                item.hook = null;
                if (item.tweenConfig != null)
                    item.tweenConfig.endHook = null;
            }

            this._items.length = 0;
            this._playing = false;
            this._onComplete = null;
        }

        public get playing(): boolean {
            return this._playing;
        }

        public setValue(label: string, ...args): void {
            var cnt: number = this._items.length;
            var found: boolean = false;
            var value: any;
            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                if (item.label == label) {
                    if (item.tweenConfig != null)
                        value = item.tweenConfig.startValue;
                    else
                        value = item.value;
                    found = true;
                }
                else if (item.tweenConfig != null && item.tweenConfig.endLabel == label) {
                    value = item.tweenConfig.endValue;
                    found = true;
                }
                else
                    continue;

                switch (item.type) {
                    case TransitionActionType.XY:
                    case TransitionActionType.Size:
                    case TransitionActionType.Pivot:
                    case TransitionActionType.Scale:
                    case TransitionActionType.Skew:
                        value.b1 = true;
                        value.b2 = true;
                        value.f1 = parseFloat(args[0]);
                        value.f2 = parseFloat(args[1]);
                        break;

                    case TransitionActionType.Alpha:
                        value.f1 = parseFloat(args[0]);
                        break;

                    case TransitionActionType.Rotation:
                        value.f1 = parseFloat(args[0]);
                        break;

                    case TransitionActionType.Color:
                        value.f1 = parseFloat(args[0]);
                        break;

                    case TransitionActionType.Animation:
                        value.frame = parseInt(args[0]);
                        if (args.length > 1)
                            value.playing = args[1];
                        break;

                    case TransitionActionType.Visible:
                        value.visible = args[0];
                        break;

                    case TransitionActionType.Sound:
                        value.sound = args[0];
                        if (args.length > 1)
                            value.volume = parseFloat(args[1]);
                        break;

                    case TransitionActionType.Transition:
                        value.transName = args[0];
                        if (args.length > 1)
                            value.playTimes = parseInt(args[1]);
                        break;

                    case TransitionActionType.Shake:
                        value.amplitude = parseFloat(args[0]);
                        if (args.length > 1)
                            value.duration = parseFloat(args[1]);
                        break;

                    case TransitionActionType.ColorFilter:
                        value.f1 = parseFloat(args[0]);
                        value.f2 = parseFloat(args[1]);
                        value.f3 = parseFloat(args[2]);
                        value.f4 = parseFloat(args[3]);
                        break;

                    case TransitionActionType.Text:
                    case TransitionActionType.Icon:
                        value.text = args[0];
                        break;
                }
            }

            if (!found)
                throw new Error("this.label not exists");
        }

        public setHook(label: string, callback: Laya.Handler): void {
            var cnt: number = this._items.length;
            var found: boolean = false;
            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                if (item.label == label) {
                    item.hook = callback;
                    found = true;
                    break;
                }
                else if (item.tweenConfig != null && item.tweenConfig.endLabel == label) {
                    item.tweenConfig.endHook = callback;
                    found = true;
                    break;
                }
            }

            if (!found)
                throw new Error("this.label not exists");
        }

        public clearHooks(): void {
            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                item.hook = null;
                if (item.tweenConfig != null)
                    item.tweenConfig.endHook = null;
            }
        }

        public setTarget(label: string, newTarget: GObject): void {
            var cnt: number = this._items.length;
            var found: boolean = false;
            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                if (item.label == label) {
                    item.targetId = (newTarget == this._owner || newTarget == null) ? "" : newTarget.id;
                    if (this._playing) {
                        if (item.targetId.length > 0)
                            item.target = this._owner.getChildById(item.targetId);
                        else
                            item.target = this._owner;
                    }
                    else
                        item.target = null;
                    found = true;
                }
            }

            if (!found)
                throw new Error("this.label not exists");
        }

        public setDuration(label: string, value: number): void {
            var cnt: number = this._items.length;
            var found: boolean = false;
            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                if (item.tweenConfig != null && item.label == label) {
                    item.tweenConfig.duration = value;
                    found = true;
                }
            }

            if (!found)
                throw new Error("this.label not exists");
        }

        public getLabelTime(label: string): number {
            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                if (item.label == label)
                    return item.time;
                else if (item.tweenConfig != null && item.tweenConfig.endLabel == label)
                    return item.time + item.tweenConfig.duration;
            }

            return NaN;
        }

        public get timeScale(): number {
            return this._timeScale;
        }

        public set timeScale(value: number) {
            if (this._timeScale != value) {
                this._timeScale = value;
                if (this._playing) {
                    var cnt: number = this._items.length;
                    for (var i: number = 0; i < cnt; i++) {
                        var item: TransitionItem = this._items[i];
                        if (item.tweener != null)
                            item.tweener.setTimeScale(value);
                        else if (item.type == TransitionActionType.Transition) {
                            if (item.value.trans != null)
                                item.value.trans.timeScale = value;
                        }
                        else if (item.type == TransitionActionType.Animation) {
                            if (item.target != null)
                                item.target.setProp(ObjectPropID.TimeScale, value);
                        }
                    }
                }
            }
        }

        public updateFromRelations(targetId: string, dx: number, dy: number): void {
            var cnt: number = this._items.length;
            if (cnt == 0)
                return;

            for (var i: number = 0; i < cnt; i++) {
                var item: TransitionItem = this._items[i];
                if (item.type == TransitionActionType.XY && item.targetId == targetId) {
                    if (item.tweenConfig != null) {
                        item.tweenConfig.startValue.f1 += dx;
                        item.tweenConfig.startValue.f2 += dy;
                        item.tweenConfig.endValue.f1 += dx;
                        item.tweenConfig.endValue.f2 += dy;
                    }
                    else {
                        item.value.f1 += dx;
                        item.value.f2 += dy;
                    }
                }
            }
        }

        public onOwnerAddedToStage(): void {
            if (this._autoPlay && !this._playing)
                this.play(null, this._autoPlayTimes, this._autoPlayDelay);
        }

        public onOwnerRemovedFromStage(): void {
            if ((this._options & Transition.OPTION_AUTO_STOP_DISABLED) == 0)
                this.stop((this._options & Transition.OPTION_AUTO_STOP_AT_END) != 0 ? true : false, false);
        }

        private onDelayedPlay(): void {
            this.internalPlay();

            this._playing = this._totalTasks > 0;
            if (this._playing) {
                if ((this._options & Transition.OPTION_IGNORE_DISPLAY_CONTROLLER) != 0) {
                    var cnt: number = this._items.length;
                    for (var i: number = 0; i < cnt; i++) {
                        var item: TransitionItem = this._items[i];
                        if (item.target != null && item.target != this._owner)
                            item.displayLockToken = item.target.addDisplayLock();
                    }
                }
            }
            else if (this._onComplete != null) {
                var handler: Laya.Handler = this._onComplete;
                this._onComplete = null;
                handler.run();
            }
        }

        private internalPlay(): void {
            this._ownerBaseX = this._owner.x;
            this._ownerBaseY = this._owner.y;

            this._totalTasks = 0;

            var cnt: number = this._items.length;
            var item: TransitionItem;
            var needSkipAnimations: boolean = false;

            if (!this._reversed) {
                for (var i: number = 0; i < cnt; i++) {
                    item = this._items[i];
                    if (item.target == null)
                        continue;

                    if (item.type == TransitionActionType.Animation && this._startTime != 0 && item.time <= this._startTime) {
                        needSkipAnimations = true;
                        item.value.flag = false;
                    }
                    else
                        this.playItem(item);
                }
            }
            else {
                for (i = cnt - 1; i >= 0; i--) {
                    item = this._items[i];
                    if (item.target == null)
                        continue;

                    this.playItem(item);
                }
            }

            if (needSkipAnimations)
                this.skipAnimations();
        }

        private playItem(item: TransitionItem): void {
            var time: number;
            if (item.tweenConfig != null) {
                if (this._reversed)
                    time = (this._totalDuration - item.time - item.tweenConfig.duration);
                else
                    time = item.time;
                if (this._endTime == -1 || time <= this._endTime) {
                    var startValue: TValue;
                    var endValue: TValue;
                    if (this._reversed) {
                        startValue = item.tweenConfig.endValue;
                        endValue = item.tweenConfig.startValue;
                    }
                    else {
                        startValue = item.tweenConfig.startValue;
                        endValue = item.tweenConfig.endValue;
                    }

                    item.value.b1 = startValue.b1 || endValue.b1;
                    item.value.b2 = startValue.b2 || endValue.b2;

                    switch (item.type) {
                        case TransitionActionType.XY:
                        case TransitionActionType.Size:
                        case TransitionActionType.Scale:
                        case TransitionActionType.Skew:
                            item.tweener = GTween.to2(startValue.f1, startValue.f2, endValue.f1, endValue.f2, item.tweenConfig.duration);
                            break;

                        case TransitionActionType.Alpha:
                        case TransitionActionType.Rotation:
                            item.tweener = GTween.to(startValue.f1, endValue.f1, item.tweenConfig.duration);
                            break;

                        case TransitionActionType.Color:
                            item.tweener = GTween.toColor(startValue.f1, endValue.f1, item.tweenConfig.duration);
                            break;

                        case TransitionActionType.ColorFilter:
                            item.tweener = GTween.to4(startValue.f1, startValue.f2, startValue.f3, startValue.f4,
                                endValue.f1, endValue.f2, endValue.f3, endValue.f4, item.tweenConfig.duration);
                            break;
                    }

                    item.tweener.setDelay(time)
                        .setEase(item.tweenConfig.easeType)
                        .setRepeat(item.tweenConfig.repeat, item.tweenConfig.yoyo)
                        .setTimeScale(this._timeScale)
                        .setTarget(item)
                        .onStart(this.onTweenStart, this)
                        .onUpdate(this.onTweenUpdate, this)
                        .onComplete(this.onTweenComplete, this);

                    if (this._endTime >= 0)
                        item.tweener.setBreakpoint(this._endTime - time);

                    this._totalTasks++;
                }
            }
            else if (item.type == TransitionActionType.Shake) {
                if (this._reversed)
                    time = (this._totalDuration - item.time - item.value.duration);
                else
                    time = item.time;

                item.value.offsetX = item.value.offsetY = 0;
                item.value.lastOffsetX = item.value.lastOffsetY = 0;
                item.tweener = GTween.shake(0, 0, item.value.amplitude, item.value.duration)
                    .setDelay(time)
                    .setTimeScale(this._timeScale)
                    .setTarget(item)
                    .onUpdate(this.onTweenUpdate, this)
                    .onComplete(this.onTweenComplete, this);

                if (this._endTime >= 0)
                    item.tweener.setBreakpoint(this._endTime - item.time);

                this._totalTasks++;
            }
            else {
                if (this._reversed)
                    time = (this._totalDuration - item.time);
                else
                    time = item.time;

                if (time <= this._startTime) {
                    this.applyValue(item);
                    this.callHook(item, false);
                }
                else if (this._endTime == -1 || time <= this._endTime) {
                    this._totalTasks++;
                    item.tweener = GTween.delayedCall(time)
                        .setTimeScale(this._timeScale)
                        .setTarget(item)
                        .onComplete(this.onDelayedPlayItem, this);
                }
            }

            if (item.tweener != null)
                item.tweener.seek(this._startTime);
        }

        private skipAnimations(): void {
            var frame: number;
            var playStartTime: number;
            var playTotalTime: number;
            var value: any;
            var target: GObject;
            var item: TransitionItem;

            var cnt: number = this._items.length;
            for (var i: number = 0; i < cnt; i++) {
                item = this._items[i];
                if (item.type != TransitionActionType.Animation || item.time > this._startTime)
                    continue;

                value = item.value;
                if (value.flag)
                    continue;

                target = item.target;
                frame = target.getProp(ObjectPropID.Frame);
                playStartTime = target.getProp(ObjectPropID.Playing) ? 0 : -1;
                playTotalTime = 0;

                for (var j: number = i; j < cnt; j++) {
                    item = this._items[j];
                    if (item.type != TransitionActionType.Animation || item.target != target || item.time > this._startTime)
                        continue;

                    value = item.value;
                    value.flag = true;

                    if (value.frame != -1) {
                        frame = value.frame;
                        if (value.playing)
                            playStartTime = item.time;
                        else
                            playStartTime = -1;
                        playTotalTime = 0;
                    }
                    else {
                        if (value.playing) {
                            if (playStartTime < 0)
                                playStartTime = item.time;
                        }
                        else {
                            if (playStartTime >= 0)
                                playTotalTime += (item.time - playStartTime);
                            playStartTime = -1;
                        }
                    }

                    this.callHook(item, false);
                }

                if (playStartTime >= 0)
                    playTotalTime += (this._startTime - playStartTime);

                target.setProp(ObjectPropID.Playing, playStartTime >= 0);
                target.setProp(ObjectPropID.Frame, frame);
                if (playTotalTime > 0)
                    target.setProp(ObjectPropID.DeltaTime, playTotalTime * 1000);
            }
        }

        private onDelayedPlayItem(tweener: GTweener): void {
            var item: TransitionItem = <TransitionItem>tweener.target;
            item.tweener = null;
            this._totalTasks--;

            this.applyValue(item);
            this.callHook(item, false);

            this.checkAllComplete();
        }

        private onTweenStart(tweener: GTweener): void {
            var item: TransitionItem = <TransitionItem>tweener.target;

            if (item.type == TransitionActionType.XY || item.type == TransitionActionType.Size) //位置和大小要到start才最终确认起始值
            {
                var startValue: TValue;
                var endValue: TValue;

                if (this._reversed) {
                    startValue = item.tweenConfig.endValue;
                    endValue = item.tweenConfig.startValue;
                }
                else {
                    startValue = item.tweenConfig.startValue;
                    endValue = item.tweenConfig.endValue;
                }

                if (item.type == TransitionActionType.XY) {
                    if (item.target != this._owner) {
                        if (!startValue.b1)
                            startValue.f1 = item.target.x;
                        if (!startValue.b2)
                            startValue.f2 = item.target.y;
                    }
                    else {
                        if (!startValue.b1)
                            startValue.f1 = item.target.x - this._ownerBaseX;
                        if (!startValue.b2)
                            startValue.f2 = item.target.y - this._ownerBaseY;
                    }
                }
                else {
                    if (!startValue.b1)
                        startValue.f1 = item.target.width;
                    if (!startValue.b2)
                        startValue.f2 = item.target.height;
                }

                if (!endValue.b1)
                    endValue.f1 = startValue.f1;
                if (!endValue.b2)
                    endValue.f2 = startValue.f2;

                tweener.startValue.x = startValue.f1;
                tweener.startValue.y = startValue.f2;
                tweener.endValue.x = endValue.f1;
                tweener.endValue.y = endValue.f2;
            }

            this.callHook(item, false);
        }

        private onTweenUpdate(tweener: GTweener): void {
            var item: TransitionItem = <TransitionItem>tweener.target;
            switch (item.type) {
                case TransitionActionType.XY:
                case TransitionActionType.Size:
                case TransitionActionType.Scale:
                case TransitionActionType.Skew:
                    item.value.f1 = tweener.value.x;
                    item.value.f2 = tweener.value.y;
                    break;

                case TransitionActionType.Alpha:
                case TransitionActionType.Rotation:
                    item.value.f1 = tweener.value.x;
                    break;

                case TransitionActionType.Color:
                    item.value.f1 = tweener.value.color;
                    break;

                case TransitionActionType.ColorFilter:
                    item.value.f1 = tweener.value.x;
                    item.value.f2 = tweener.value.y;
                    item.value.f3 = tweener.value.z;
                    item.value.f4 = tweener.value.w;
                    break;

                case TransitionActionType.Shake:
                    item.value.offsetX = tweener.deltaValue.x;
                    item.value.offsetY = tweener.deltaValue.y;
                    break;
            }

            this.applyValue(item);
        }

        private onTweenComplete(tweener: GTweener): void {
            var item: TransitionItem = <TransitionItem>tweener.target;
            item.tweener = null;
            this._totalTasks--;

            if (tweener.allCompleted) //当整体播放结束时间在这个tween的中间时不应该调用结尾钩子
                this.callHook(item, true);

            this.checkAllComplete();
        }

        private onPlayTransCompleted(item: TransitionItem): void {
            this._totalTasks--;

            this.checkAllComplete();
        }

        private callHook(item: TransitionItem, tweenEnd: boolean): void {
            if (tweenEnd) {
                if (item.tweenConfig != null && item.tweenConfig.endHook != null)
                    item.tweenConfig.endHook.run();
            }
            else {
                if (item.time >= this._startTime && item.hook != null)
                    item.hook.run();
            }
        }

        private checkAllComplete(): void {
            if (this._playing && this._totalTasks == 0) {
                if (this._totalTimes < 0) {
                    this.internalPlay();
                }
                else {
                    this._totalTimes--;
                    if (this._totalTimes > 0)
                        this.internalPlay();
                    else {
                        this._playing = false;

                        var cnt: number = this._items.length;
                        for (var i: number = 0; i < cnt; i++) {
                            var item: TransitionItem = this._items[i];
                            if (item.target != null && item.displayLockToken != 0) {
                                item.target.releaseDisplayLock(item.displayLockToken);
                                item.displayLockToken = 0;
                            }
                        }

                        if (this._onComplete != null) {
                            var handler: Laya.Handler = this._onComplete;
                            this._onComplete = null;
                            handler.run();
                        }
                    }
                }
            }
        }

        private applyValue(item: TransitionItem): void {
            item.target._gearLocked = true;

            switch (item.type) {
                case TransitionActionType.XY:
                    if (item.target == this._owner) {
                        var f1: number, f2: number;
                        if (!item.value.b1)
                            f1 = item.target.x;
                        else
                            f1 = item.value.f1 + this._ownerBaseX;
                        if (!item.value.b2)
                            f2 = item.target.y;
                        else
                            f2 = item.value.f2 + this._ownerBaseY;
                        item.target.setXY(f1, f2);
                    }
                    else {
                        if (!item.value.b1)
                            item.value.f1 = item.target.x;
                        if (!item.value.b2)
                            item.value.f2 = item.target.y;
                        item.target.setXY(item.value.f1, item.value.f2);
                    }
                    break;

                case TransitionActionType.Size:
                    if (!item.value.b1)
                        item.value.f1 = item.target.width;
                    if (!item.value.b2)
                        item.value.f2 = item.target.height;
                    item.target.setSize(item.value.f1, item.value.f2);
                    break;

                case TransitionActionType.Pivot:
                    item.target.setPivot(item.value.f1, item.value.f2, item.target.pivotAsAnchor);
                    break;

                case TransitionActionType.Alpha:
                    item.target.alpha = item.value.f1;
                    break;

                case TransitionActionType.Rotation:
                    item.target.rotation = item.value.f1;
                    break;

                case TransitionActionType.Scale:
                    item.target.setScale(item.value.f1, item.value.f2);
                    break;

                case TransitionActionType.Skew:
                    item.target.setSkew(item.value.f1, item.value.f2);
                    break;

                case TransitionActionType.Color:
                    item.target.setProp(ObjectPropID.Color, ToolSet.convertToHtmlColor(item.value.f1, false));
                    break;

                case TransitionActionType.Animation:
                    if (item.value.frame >= 0)
                        item.target.setProp(ObjectPropID.Frame, item.value.frame);
                    item.target.setProp(ObjectPropID.Playing, item.value.playing);
                    item.target.setProp(ObjectPropID.TimeScale, this._timeScale);
                    break;

                case TransitionActionType.Visible:
                    item.target.visible = item.value.visible;
                    break;

                case TransitionActionType.Transition:
                    if (this._playing) {
                        var trans: Transition = item.value.trans;
                        if (trans != null) {
                            this._totalTasks++;
                            var startTime: number = this._startTime > item.time ? (this._startTime - item.time) : 0;
                            var endTime: number = this._endTime >= 0 ? (this._endTime - item.time) : -1;
                            if (item.value.stopTime >= 0 && (endTime < 0 || endTime > item.value.stopTime))
                                endTime = item.value.stopTime;
                            trans.timeScale = this._timeScale;
                            trans._play(Laya.Handler.create(this, this.onPlayTransCompleted, [item]), item.value.playTimes, 0, startTime, endTime, this._reversed);
                        }
                    }
                    break;

                case TransitionActionType.Sound:
                    if (this._playing && item.time >= this._startTime) {
                        if (item.value.audioClip == null) {
                            var pi: PackageItem = UIPackage.getItemByURL(item.value.sound);
                            if (pi)
                                item.value.audioClip = pi.file;
                            else
                                item.value.audioClip = item.value.sound;
                        }
                        if (item.value.audioClip)
                            GRoot.inst.playOneShotSound(item.value.audioClip, item.value.volume);
                    }
                    break;

                case TransitionActionType.Shake:
                    item.target.setXY(item.target.x - item.value.lastOffsetX + item.value.offsetX, item.target.y - item.value.lastOffsetY + item.value.offsetY);
                    item.value.lastOffsetX = item.value.offsetX;
                    item.value.lastOffsetY = item.value.offsetY;
                    break;

                case TransitionActionType.ColorFilter:
                    {
                        var arr: any[] = item.target.filters;

                        var cm: ColorMatrix = new ColorMatrix();
                        cm.adjustBrightness(item.value.f1);
                        cm.adjustContrast(item.value.f2);
                        cm.adjustSaturation(item.value.f3);
                        cm.adjustHue(item.value.f4);
                        arr = [new Laya.ColorFilter(cm)];
                        item.target.filters = arr;
                        break;
                    }

                case TransitionActionType.Text:
                    item.target.text = item.value.text;
                    break;

                case TransitionActionType.Icon:
                    item.target.icon = item.value.text;
                    break;
            }

            item.target._gearLocked = false;
        }

        public setup(buffer: ByteBuffer): void {
            this.name = buffer.readS();
            this._options = buffer.getInt32();
            this._autoPlay = buffer.readBool();
            this._autoPlayTimes = buffer.getInt32();
            this._autoPlayDelay = buffer.getFloat32();

            var cnt: number = buffer.getInt16();
            for (var i: number = 0; i < cnt; i++) {
                var dataLen: number = buffer.getInt16();
                var curPos: number = buffer.pos;

                buffer.seek(curPos, 0);

                var item: TransitionItem = new TransitionItem(buffer.readByte());
                this._items[i] = item;

                item.time = buffer.getFloat32();
                var targetId: number = buffer.getInt16();
                if (targetId < 0)
                    item.targetId = "";
                else
                    item.targetId = this._owner.getChildAt(targetId).id;
                item.label = buffer.readS();

                if (buffer.readBool()) {
                    buffer.seek(curPos, 1);

                    item.tweenConfig = new TweenConfig();
                    item.tweenConfig.duration = buffer.getFloat32();
                    if (item.time + item.tweenConfig.duration > this._totalDuration)
                        this._totalDuration = item.time + item.tweenConfig.duration;
                    item.tweenConfig.easeType = buffer.readByte();
                    item.tweenConfig.repeat = buffer.getInt32();
                    item.tweenConfig.yoyo = buffer.readBool();
                    item.tweenConfig.endLabel = buffer.readS();

                    buffer.seek(curPos, 2);

                    this.decodeValue(item, buffer, item.tweenConfig.startValue);

                    buffer.seek(curPos, 3);

                    this.decodeValue(item, buffer, item.tweenConfig.endValue);
                }
                else {
                    if (item.time > this._totalDuration)
                        this._totalDuration = item.time;

                    buffer.seek(curPos, 2);

                    this.decodeValue(item, buffer, item.value);
                }

                buffer.pos = curPos + dataLen;
            }
        }

        private decodeValue(item: TransitionItem, buffer: ByteBuffer, value: any): void {
            switch (item.type) {
                case TransitionActionType.XY:
                case TransitionActionType.Size:
                case TransitionActionType.Pivot:
                case TransitionActionType.Skew:
                    value.b1 = buffer.readBool();
                    value.b2 = buffer.readBool();
                    value.f1 = buffer.getFloat32();
                    value.f2 = buffer.getFloat32();
                    break;

                case TransitionActionType.Alpha:
                case TransitionActionType.Rotation:
                    value.f1 = buffer.getFloat32();
                    break;

                case TransitionActionType.Scale:
                    value.f1 = buffer.getFloat32();
                    value.f2 = buffer.getFloat32();
                    break;

                case TransitionActionType.Color:
                    value.f1 = buffer.readColor();
                    break;

                case TransitionActionType.Animation:
                    value.playing = buffer.readBool();
                    value.frame = buffer.getInt32();
                    break;

                case TransitionActionType.Visible:
                    value.visible = buffer.readBool();
                    break;

                case TransitionActionType.Sound:
                    value.sound = buffer.readS();
                    value.volume = buffer.getFloat32();
                    break;

                case TransitionActionType.Transition:
                    value.transName = buffer.readS();
                    value.playTimes = buffer.getInt32();
                    break;

                case TransitionActionType.Shake:
                    value.amplitude = buffer.getFloat32();
                    value.duration = buffer.getFloat32();
                    break;

                case TransitionActionType.ColorFilter:
                    value.f1 = buffer.getFloat32();
                    value.f2 = buffer.getFloat32();
                    value.f3 = buffer.getFloat32();
                    value.f4 = buffer.getFloat32();
                    break;

                case TransitionActionType.Text:
                case TransitionActionType.Icon:
                    value.text = buffer.readS();
                    break;
            }
        }
    }

    class TransitionActionType {
        public static XY: number = 0;
        public static Size: number = 1;
        public static Scale: number = 2;
        public static Pivot: number = 3;
        public static Alpha: number = 4;
        public static Rotation: number = 5;
        public static Color: number = 6;
        public static Animation: number = 7;
        public static Visible: number = 8;
        public static Sound: number = 9;
        public static Transition: number = 10;
        public static Shake: number = 11;
        public static ColorFilter: number = 12;
        public static Skew: number = 13;
        public static Text: number = 14;
        public static Icon: number = 15;
        public static Unknown: number = 16;
    }

    class TransitionItem {
        public time: number;
        public targetId: string;
        public type: number;
        public tweenConfig: TweenConfig;
        public label: string;
        public value: any;
        public hook: Laya.Handler;

        public tweener: GTweener;
        public target: GObject;
        public displayLockToken: number;

        constructor(type: number) {
            this.type = type;

            switch (type) {
                case TransitionActionType.XY:
                case TransitionActionType.Size:
                case TransitionActionType.Scale:
                case TransitionActionType.Pivot:
                case TransitionActionType.Skew:
                case TransitionActionType.Alpha:
                case TransitionActionType.Rotation:
                case TransitionActionType.Color:
                case TransitionActionType.ColorFilter:
                    this.value = new TValue();
                    break;

                case TransitionActionType.Animation:
                    this.value = new TValue_Animation();
                    break;

                case TransitionActionType.Shake:
                    this.value = new TValue_Shake();
                    break;

                case TransitionActionType.Sound:
                    this.value = new TValue_Sound();
                    break;

                case TransitionActionType.Transition:
                    this.value = new TValue_Transition();
                    break;

                case TransitionActionType.Visible:
                    this.value = new TValue_Visible();
                    break;

                case TransitionActionType.Text:
                case TransitionActionType.Icon:
                    this.value = new TValue_Text();
                    break;
            }
        }
    }

    class TweenConfig {
        public duration: number;
        public easeType: number;
        public repeat: number;
        public yoyo: boolean;
        public startValue: TValue;
        public endValue: TValue;
        public endLabel: string;
        public endHook: Laya.Handler;

        constructor() {
            this.easeType = EaseType.QuadOut;
            this.startValue = new TValue();
            this.endValue = new TValue();
        }
    }

    class TValue_Visible {
        public visible: boolean;
    }

    class TValue_Animation {
        public frame: number;
        public playing: boolean;
        public flag: boolean;
    }

    class TValue_Sound {
        public sound: string;
        public volume: number;
        public audioClip: string;
    }

    class TValue_Transition {
        public transName: string;
        public playTimes: number;
        public trans: Transition;
        public stopTime: number;
    }

    class TValue_Shake {
        public amplitude: number;
        public duration: number;
        public offsetX: number;
        public offsetY: number;
        public lastOffsetX: number;
        public lastOffsetY: number;
    }

    class TValue_Text {
        public text: string;
    }

    class TValue {
        public f1: number;
        public f2: number;
        public f3: number;
        public f4: number;

        public b1: boolean;
        public b2: boolean;

        constructor() {
            this.b1 = this.b2 = true;
        }
    }


}