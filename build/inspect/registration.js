function GetWrapData(componentId) {
    return window.SimHubWrapItems[componentId];
}

function UnWrap(itemkey) {
    delete window.SimHubWrapItems[itemkey];
}

function PropertyWrapData(itemWrapData, propertyName) {
    var Callbacks = [];
    var AlsoNotify = []
    var _itemWrapData = itemWrapData;
    var _propertyName = propertyName

    function addPropertyCallback(callback) {
        Callbacks.push(callback);
        return this;
    }

    function addDependantProperties() {
        if (arguments !== undefined && arguments != null) {
            for (var i = 0; i < arguments.length; i++) {
                var linkedpropName = arguments[i];
                _itemWrapData.getPropertyWrap(linkedpropName).addAlsoNotify(_propertyName);
            }
        }
        return this;
    }

    function addAlsoNotify(propertyName) {
        AlsoNotify.push(propertyName);
        return this;
    }

    return {
        addAlsoNotify: addAlsoNotify,
        Callbacks: Callbacks,
        AlsoNotify: AlsoNotify,
        addPropertyCallback: addPropertyCallback,
        addDependantProperties: addDependantProperties
    }
}

function ItemWrapData(item) {
    var _item = item;
    var _propertyWrapDatas = []

    function executeCallbacks(parentTask, propertyName, newvalue, reentrant) {
        var propertyWrapData = _propertyWrapDatas[propertyName];

        if (propertyWrapData != null) {
            var arrayLength = propertyWrapData.Callbacks.length;
            for (var i = 0; i < arrayLength; i++) {
                propertyWrapData.Callbacks[i](newvalue, parentTask);
            }

            if (!reentrant) {
                for (var i in propertyWrapData.AlsoNotify) {
                    var propName = propertyWrapData.AlsoNotify[i];
                    executeCallbacks(parentTask, propName, _item[propName], true)
                }
            }
        }
    }

    function getPropertyWrap(propertyName) {
        var propertyWrapData = _propertyWrapDatas[propertyName];

        if (propertyWrapData === undefined) {
            propertyWrapData = new PropertyWrapData(this, propertyName);
            _propertyWrapDatas[propertyName] = propertyWrapData;
        }
        return propertyWrapData;
    }

    return {
        Item: _item,
        _propertyWrapDatas: _propertyWrapDatas,
        executeCallbacks: executeCallbacks,
        getPropertyWrap: getPropertyWrap
    }
}

function WrapNoInit(item, propertyName, action) {
    return Wrap(item, propertyName, action, true)
}

function GetOrInitWrapData(item) {
    var wrapdata = window.SimHubWrapItems[item.uid];
    if (wrapdata === undefined) {
        wrapdata = new ItemWrapData(item);
        window.SimHubWrapItems[item.uid] = wrapdata;
    }

    return wrapdata;
}

function Wrap(item, propertyName, callback, noinitCallback) {
    var mainPropertyWrapData = GetOrInitWrapData(item)
        .getPropertyWrap(propertyName)
        .addPropertyCallback(callback);

    if (noinitCallback != true)
        callback(item[propertyName], null);

    return mainPropertyWrapData;
}

function RegisterCustomData(dashboard, item, action) {
    window.SimHubDataCallBacks[item.uid] = action;
}

function RegisterVisibilityCheck(dashboard, item, action) {
    window.SimHubVisibilityCheckCallBacks[item.uid] = action;
}

// Runtime functions
function changeVis(parentTask, data, state) {
    for (var componentId in data) {
        var component = data[componentId];
        var wrapdata = window.GetWrapData(component);
        if (wrapdata) {
            wrapdata.Item["VisibleEx"] = state;
            wrapdata.executeCallbacks(parentTask, "VisibleEx", state);
        } else {
            console.error("Component missing " + componentId);
        }
    }
}

function setProp(parentTask, data, propname) {
    for (componentId in data) {
        newValue = data[componentId];
        var wrapdata = window.GetWrapData(componentId);
        if (wrapdata) {
            wrapdata.Item[propname] = newValue;
            wrapdata.executeCallbacks(parentTask, propname, newValue);
        } else {
            console.error("Component missing " + componentId);
        }
    }
}

function updateProperties(parentTask, C) {
    var newValue = null;
    var component = null;
    for (componentId in C) {
        component = C[componentId];
        for (propertyName in component) {
            //var propertyName = data.P[propertyIndex];
            newValue = component[propertyName];
            var wrapdata = window.GetWrapData(componentId);

            var a = null;
            if (propertyName.indexOf(".") > 0) {
                if (wrapdata != null && wrapdata.Item != null) {
                    var a = propertyName.split('.');
                    var o = wrapdata.Item;

                    for (var i = 0; i < a.length - 1; i++) {
                        var n = a[i];
                        if (n in o) {
                            o = o[n];
                        } else {
                            o[n] = {};
                            o = o[n];
                        }
                    }

                    o[a[a.length - 1]] = newValue;

                    var partialPName = a[0];
                    for (var i = 0; i < a.length; i++) {
                        if (i > 0) {
                            partialPName = partialPName + "." + a[i];
                        }
                        wrapdata.executeCallbacks(parentTask, partialPName, newValue);
                    }
                }
            } else {
                wrapdata.Item[propertyName] = newValue;
                wrapdata.executeCallbacks(parentTask, propertyName, newValue);
            }
        }
    }
}