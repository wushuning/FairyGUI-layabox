import MailItem from "./MailItem"

export default class ListEffectDemo {
    private _view: fgui.GComponent;
    private _list: fgui.GList;

    constructor() {
        fgui.UIPackage.loadPackage("res/UI/ListEffect", Laya.Handler.create(this, this.onUILoaded));
    }

    onUILoaded() {
        fgui.UIObjectFactory.setPackageItemExtension("ui://ListEffect/mailItem", MailItem);

        this._view = fgui.UIPackage.createObject("ListEffect", "Main").asCom;
        this._view.setSize(fgui.GRoot.inst.width, fgui.GRoot.inst.height);
        fgui.GRoot.inst.addChild(this._view);

        this._list = this._view.getChild("mailList").asList;
        for (var i: number = 0; i < 10; i++) {
            var item: MailItem = <MailItem>this._list.addItemFromPool();
            item.setFetched(i % 3 == 0);
            item.setRead(i % 2 == 0);
            item.setTime("5 Nov 2015 16:24:33");
            item.title = "Mail title here";
        }

        this._list.ensureBoundsCorrect();
        var delay: number = 0;
        for (var i: number = 0; i < 10; i++) {
            var item: MailItem = <MailItem>this._list.getChildAt(i);
            if (this._list.isChildInView(item)) {
                item.playEffect(delay);
                delay += 0.2;
            }
            else
                break;
        }
    }
}
