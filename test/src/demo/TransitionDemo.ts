export default class TransitionDemo {
    private _view: fgui.GComponent;

    private _btnGroup: fgui.GGroup;
    private _g1: fgui.GComponent;
    private _g2: fgui.GComponent;
    private _g3: fgui.GComponent;
    private _g4: fgui.GComponent;
    private _g5: fgui.GComponent;

    private _startValue: number;
    private _endValue: number;

    constructor() {
        fgui.UIPackage.loadPackage("res/UI/Transition", Laya.Handler.create(this, this.onUILoaded));
    }

    onUILoaded() {
        this._view = fgui.UIPackage.createObject("Transition", "Main").asCom;
        this._view.makeFullScreen();
        fgui.GRoot.inst.addChild(this._view);

        this._btnGroup = this._view.getChild("g0").asGroup;

        this._g1 = fgui.UIPackage.createObject("Transition", "BOSS").asCom;
        this._g2 = fgui.UIPackage.createObject("Transition", "BOSS_SKILL").asCom;
        this._g3 = fgui.UIPackage.createObject("Transition", "TRAP").asCom;
        this._g4 = fgui.UIPackage.createObject("Transition", "GoodHit").asCom;
        this._g5 = fgui.UIPackage.createObject("Transition", "PowerUp").asCom;
        //play_num_now是在编辑器里设定的名称，这里表示播放到'play_num_now'这个位置时才开始播放数字变化效果
        this._g5.getTransition("t0").setHook("play_num_now", Laya.Handler.create(this, this.__playNum, null, false));

        this._view.getChild("btn0").onClick(this, function (): void { this.__play(this._g1); });
        this._view.getChild("btn1").onClick(this, function (): void { this.__play(this._g2); });
        this._view.getChild("btn2").onClick(this, function (): void { this.__play(this._g3); });
        this._view.getChild("btn3").onClick(this, this.__play4);
        this._view.getChild("btn4").onClick(this, this.__play5);
    }

    private __play(target: fgui.GComponent): void {
        this._btnGroup.visible = false;
        fgui.GRoot.inst.addChild(target);
        var t: fgui.Transition = target.getTransition("t0");
        t.play(Laya.Handler.create(this, () => {
            this._btnGroup.visible = true;
            fgui.GRoot.inst.removeChild(target);
        }));
    }

    private __play4(): void {
        this._btnGroup.visible = false;
        this._g4.x = fgui.GRoot.inst.width - this._g4.width - 20;
        this._g4.y = 100;
        fgui.GRoot.inst.addChild(this._g4);
        var t: fgui.Transition = this._g4.getTransition("t0");
        //播放3次
        t.play(Laya.Handler.create(this, () => {
            this._btnGroup.visible = true;
            fgui.GRoot.inst.removeChild(this._g4);
        }), 3);
    }

    private __play5(): void {
        this._btnGroup.visible = false;
        this._g5.x = 20;
        this._g5.y = fgui.GRoot.inst.height - this._g5.height - 100;
        fgui.GRoot.inst.addChild(this._g5);
        var t: fgui.Transition = this._g5.getTransition("t0");
        this._startValue = 10000;
        var add: number = Math.ceil(Math.random() * 2000 + 1000);
        this._endValue = this._startValue + add;
        this._g5.getChild("value").text = "" + this._startValue;
        this._g5.getChild("add_value").text = "+" + add;
        t.play(Laya.Handler.create(this, () => {
            this._btnGroup.visible = true;
            fgui.GRoot.inst.removeChild(this._g5);
        }));
    }

    private __playNum(): void {
        //这里演示了一个数字变化的过程
        fgui.GTween.to(this._startValue, this._endValue, 0.3)
            .setEase(fgui.EaseType.Linear)
            .onUpdate(function (tweener): void {
                this._g5.getChild("value").text = "" + Math.floor(tweener.value.x);
            }, this);
    }
}

