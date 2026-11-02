function GetBaseType(component) {
    return component.$type;
}

function RenderScreen(container, dashboard, screendata, templateInstanceUid, parentTask) {
    if (templateInstanceUid != "") {
        screendata.ScreenWebId = "s_" + templateInstanceUid + "_" + screendata.ScreenSid;
    } else {
        screendata.ScreenWebId = "s_" + screendata.ScreenSid;
    }

    var screen = $("<div class='screen' />");
    screen.hide();

    if (screendata.IdleScreen) {
        screen.addClass("idle");
    }

    if (screendata.PitScreen) {
        screen.addClass("pit");
    }

    if (screendata.ForegroundLayer) {
        screen.addClass("foreground");
    }

    if (screendata.IsOverlayLayer) {
        screen.removeClass("screen");
        screen.addClass("overlaylayer");
    }

    screen.addClass("waitingforrender");
    screen.attr("data-name", screendata.Name);
    screen.attr("id", screendata.ScreenWebId);

    if (screendata.InGameScreen) {
        screen.addClass("ingame");
    }

    screen.width(dashboard.BaseWidth);
    screen.height(dashboard.BaseHeight);

    if (!screendata.IsOverlayLayer && !screendata.IsForegroundLayer && DefaultValue(screendata.BackgroundLayerId, null) === null) {
        if (!dashboard.isWidget) {
            var bg = hex2rgba(screendata.BackgroundColor);
            if (bg === "rgba(255, 255, 255, 0)") bg = null;
            screen.css({ "background-color": bg });
        }

        SetImage(screen, screendata.Background, dashboard);
        screen.get(0).style.backgroundSize = dashboard.BaseWidth + 'px ' + dashboard.BaseHeight + 'px';
    }

    screendata.Items.forEach(function (element) {
        RenderItem(screen, element, dashboard, screendata, templateInstanceUid, "", parentTask);
    });

    screen.appendTo(container);

    return screen;
}

function UpdateItemUid(templateInstanceUid, element, repetition) {
    if (templateInstanceUid != "") {
        element.uid = templateInstanceUid + "_" + element.Sid.toString();
    } else {
        element.uid = element.Sid.toString();
    }

    if (repetition != null && repetition != undefined && repetition != "")
        element.uid = element.uid + repetition;
}

function RenderItem(container, element, dashboard, screen, templateInstanceUid, repetition, parentTask) {
    UpdateItemUid(templateInstanceUid, element, repetition);

    var elementcontainer = $(document.createElement("div")).addClass('dash-item');

    //elementcontainer.css("-webkit-transform", "translate3d(0,0,0)");
    var htmlelementcontainer = elementcontainer.get(0);
    elementcontainer.attr("id", "item_" + element.uid);
    elementcontainer.attr("data-uid", element.uid);
    htmlelementcontainer.SourceItem = element;

    elementcontainer.addClass("nopointerevents");

    var islayer = element.$type === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.Layer, SimHub.Plugins";
    element.BorderStyle = DefaultValue(element.BorderStyle, {});

    // Initial visibility
    if (!element.Visible) {
        htmlelementcontainer.style.display = 'none';
    }

    WrapNoInit(element, 'VisibleEx', function (value) {
        if (value) {
            htmlelementcontainer.style.display = null;
        } else {
            htmlelementcontainer.style.display = 'none';
        }
    });

    Wrap(element, 'BorderStyle', function (value) {
        BorderStyleToCss(elementcontainer, element.BorderStyle);
    });

    Wrap(element, 'Width', function (value) {
        elementcontainer.css({ 'width': value + "px" });
    });

    element.Opacity = DefaultValue(element.Opacity, 100);
    Wrap(element, 'Opacity', function (value) {
        if (value === 100) {
            elementcontainer.css("opacity", "");
        } else {
            elementcontainer.css("opacity", value / 100);
        }
    });

    element.BlurRadius = DefaultValue(element.BlurRadius, 0.0);
    Wrap(element, 'BlurRadius', function (value) {
        if (value > 0) {
            elementcontainer.css({ "filter": "blur(" + (value / 2) + "px)" });
        } else {
            elementcontainer.css({ "filter": "" });
        }
    });

    Wrap(element, 'Height', function (value) {
        elementcontainer.css({ 'height': value + "px" });
    });

    Wrap(element, 'Left', function (value) {
        elementcontainer.css({ "left": value + "px" });
    });

    Wrap(element, 'Top', function (value) {
        elementcontainer.css({ "top": value + "px" });
    });

    if (!islayer) {
        Wrap(element, 'BackgroundColor', function (value) {
            var bg = hex2rgba(value);
            if (bg === "rgba(255,255,255,0)") {
                elementcontainer.css({ "background-color": "" });
            } else {
                elementcontainer.css({ "background-color": bg });
            }
        });
    }

    if (!islayer) {
        element.Rotation = DefaultValue(element.Rotation, 0.0);
        element.SkewAngleX = DefaultValue(element.SkewAngleX, 0.0);
        element.SkewAngleY = DefaultValue(element.SkewAngleY, 0.0);
        Wrap(element, "Rotation", function (value) {
            rotateandskew(elementcontainer, element.Rotation, element.SkewAngleX, element.SkewAngleY);
        }).addDependantProperties("SkewAngleX", "SkewAngleY")
    }

    elementcontainer.attr("data-name", element.Name);
    var elementType = GetBaseType(element);
    var regex = /\.([A-z0-9]*),/g;
    var m = regex.exec(elementType);
    var componentType = m[1];
    elementcontainer.addClass(componentType);

    if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.RectangleItem, SimHub.Plugins" || element.IsRectangleItem) {
        // Nothing to do
    }

    if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.DeviceLedsControlItem, SimHub.Plugins" || element.IsRectangleItem) {
        // Nothing to do
    }

    // Groups
    else if (element.$type === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.Layer, SimHub.Plugins") {
        renderLayer(element, elementcontainer, dashboard, templateInstanceUid, repetition, parentTask);
    }
    else if (element.$type === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.GroupItem, SimHub.Plugins") {
        renderGroup(element, elementcontainer, dashboard, templateInstanceUid, repetition, parentTask);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ButtonItem, SimHub.Plugins") {
        renderButtonItem(element, elementcontainer, dashboard, templateInstanceUid, repetition, parentTask);
    }
    // Others
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.OutlinedTextItem, SimHub.Plugins") {
        renderOutlinedTextItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.TextItem, SimHub.Plugins" || element.IsTextItem) {
        renderTextItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.OutlinedTextItem, SimHub.Plugins") {
        renderTextItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.GeneratedStaticMapItem, SimHub.Plugins") {
        renderGeneratedStaticMapItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.GeneratedMapItem, SimHub.Plugins") {
        renderGeneratedMapItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.WidgetItem, SimHub.Plugins") {
        renderWidgetItem(element, elementcontainer, dashboard, parentTask);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ImageItem, SimHub.Plugins") {
        renderImageItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ImageFromFileItem, SimHub.Plugins") {
        renderImageFromFileItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.MediaCoverItem, SimHub.Plugins") {
        renderImageFromFileItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ImageFromUrlItem, SimHub.Plugins") {
        renderImageFromFileItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ToggleImageItem, SimHub.Plugins" || element.IsToggleImage) {
        renderToggleImageItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.EllipseItem, SimHub.Plugins") {
        renderEllipseItem(element, elementcontainer, dashboard);
    }

    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.LinearGaugeItem, SimHub.Plugins" || element.IsLinearGauge) {
        if (element.GaugeOrientation === 0) {
            renderLinearGauge(element, elementcontainer, dashboard);
        } else {
            renderVerticalLinearGauge(element, elementcontainer, dashboard);
        }
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.GradientItem, SimHub.Plugins") {
        renderGradientItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.VideoItem, SimHub.Plugins") {
        renderVideoItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ScreenCaptureItem, SimHub.Plugins") {
        renderScreenCaptureItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.AnimatedGifItem, SimHub.Plugins") {
        renderAnimatedGifItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.DialGaugeItem, SimHub.Plugins") {
        renderDialGauge(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.RadarItem, SimHub.Plugins") {
        renderRadarItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.CircularGaugeItem, SimHub.Plugins") {
        renderCircularGaugeItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ArcGaugeItem, SimHub.Plugins") {
        renderArcGaugeItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ETSMap, SimHub.Plugins") {
        renderETSMap(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.WebPageItem, SimHub.Plugins") {
        renderWebPageItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.IntegratedLedItem, SimHub.Plugins") {
        renderIntegratedLedItem(element, elementcontainer, dashboard);
    }
    else if (elementType === "SimHub.Plugins.OutputPlugins.GraphicalDash.Models.ChartItem, SimHub.Plugins") {
        renderChartItem(element, elementcontainer, dashboard);
    }
    else {
        console.log("Unsupported component type : " + element.$type);
        return;
    }

    elementcontainer.appendTo(container);
    element.Binding = null;
}

function renderLayer(item, elementcontainer, dashboard, templateInstanceUid, currentrepetition, parentTask) {
    if (item.Childrens == null) {
        item.Childrens = [];
    }

    var originalLayer = null;

    if (item.PrepareRepetitions == true) {
        originalLayer = $.extend(true, [], item.Childrens);
    }

    item.Childrens.forEach(function (element) {
        elementcontainer.css({ "left": "0px" });
        elementcontainer.css({ "top": "0px" });
        elementcontainer.width(dashboard.BaseWidth);
        elementcontainer.height(dashboard.BaseHeight);

        RenderItem(elementcontainer, element, dashboard, screen, templateInstanceUid, currentrepetition + "r0", parentTask);
    });

    function setRepetitionOffset(repetitioncontainer, repetition) {
        repetitioncontainer.css({ "left": ((repetition) * DefaultValue(item.RepeatLeftOffset, 0)) + "px" });
        repetitioncontainer.css({ "top": ((repetition) * DefaultValue(item.RepeatTopOffset, 30)) });
    }

    function addRepetition(repetition, parentTask) {
        var repetitioncontainer = $(document.createElement("div"))
            .addClass('layer-repetition')
            .attr("repetitionid", repetition);

        var childrensClone = $.extend(true, [], originalLayer);

        childrensClone.forEach(function (element) {
            repetitioncontainer.css({ "position": "absolute" });
            setRepetitionOffset(repetitioncontainer, repetition)
            RenderItem(repetitioncontainer, element, dashboard, screen, templateInstanceUid, currentrepetition + "r" + repetition, parentTask);
        });
        repetitioncontainer.appendTo(elementcontainer);
        return repetitioncontainer;
    }

    var currentRepetition = [];

    function updateRepetitions(parentTask) {
        var generatedRepetions = Math.max(item.Repetitions, 0);

        while (currentRepetition.length < generatedRepetions) {
            currentRepetition.push(addRepetition(currentRepetition.length + 1, parentTask));
        }

        while (currentRepetition.length > generatedRepetions) {
            var repetionContainer = currentRepetition[currentRepetition.length - 1];
            currentRepetition[currentRepetition.length - 1].remove();
            currentRepetition.pop();
            $(".dash-item", repetionContainer).each(function (element) {
                UnWrap($(this).attr("data-uid"));
            });
        }
    }

    WrapNoInit(item, "Repetitions", function (value, task) {
        //console.log("RepetitionsUpdateStarted");
        new FakeTask(task)
            .onRun(function (childTask) {
                updateRepetitions(childTask);
            })
            .onComplete(function () {
                //console.log("RepetitionsUpdated");
            }).start();
    });

    updateRepetitions(parentTask);

    WrapNoInit(item, "RepeatLeftOffset", function (value) {
        for (var i in currentRepetition) {
            setRepetitionOffset(currentRepetition[i], Number(i) + 1);
        }
    }).addDependantProperties("RepeatTopOffset");
}

function renderGroup(item, elementcontainer, dashboard, templateInstanceUid, currentrepetition, parentTask) {
    var content = $(document.createElement("div"));
    content.css("position", "absolute");

    if (item.Childrens == null) {
        item.Childrens = [];
    }

    Wrap(item, "BorderStyle", function () {
        AntiMarginPosition(content, item.BorderStyle);
    });
    item.Childrens.forEach(function (element) {
        RenderItem(content, element, dashboard, screen, templateInstanceUid, currentrepetition, parentTask);
    });
    content.appendTo(elementcontainer);
}

function renderETSMap(item, container, dashboard) {
    var content = $("<iframe></iframe>");
    content.css("pointer-events", "auto");
    AntiMargin(content, item.BorderStyle);

    Wrap(item, "Width", function (value) {
        content.width(value);
    });

    Wrap(item, "Height", function (value) {
        content.height(value);
    });

    cachebuster = Math.round(new Date().getTime());
    content.attr("src", "/maps/map.html?v=" + cachebuster + "#norefresh");

    content.appendTo(container);
    RegisterCustomData(dashboard, item, function (data) {
        if (content.get(0).contentWindow != null && content.get(0).contentWindow.document.setPosition != null) {
            content.get(0).contentWindow.document.setPosition(data[0], data[1], data[3], data[2]);
        }
    });
}

function renderRadarItem(item, container, dashboard) {
    var htmlcontainer = container.get(0);
    var host = $("<img class='noselect' style='position:absolute'></img>");
    var ohost = $("<div style='position:absolute'></div>");
    item.opps = [];
    var renderIdx = 0;

    RegisterCustomData(dashboard, item, function (data) {
        renderIdx = (renderIdx + 1 % 100);
        for (var idx in data) {
            opponent = data[idx];
            var htmlopp = item.opps[opponent.Id];
            if (htmlopp == null) {
                $htmlopp = $("<div><div></div></div>");

                $htmlopp.addClass("o" + opponent.Id);
                $htmlopp.css("position", "absolute");
                item.opps[opponent.Id] = $htmlopp.get(0);
                htmlopp = $htmlopp.get(0);
                $htmlopp.css("transform", "scale(" + item.Scale + ")");
                if (opponent.IP) {
                    ApplyRadarStyle($htmlopp.children().first(), item.PlayerStyle);
                } else {
                    ApplyRadarStyle($htmlopp.children().first(), item.OpponentStyle);
                }
                scale($(htmlopp.children[0]), item.Scale);

                htmlopp.originalStyle = htmlopp.getAttribute('style');
                htmlopp.children[0].originalStyle = htmlopp.children[0].getAttribute('style');

                $htmlopp.appendTo(ohost);
            }

            htmlopp.renderIdx = renderIdx;
            var degrees = opponent.A;
            htmlopp.setAttribute('style', htmlopp.originalStyle + "margin:0 ;position:absolute;left:" + opponent.L + "px; top:" + opponent.T + "px");
            htmlopp.children[0].setAttribute('style', htmlopp.children[0].originalStyle + ';-webkit-transform : rotate(' + degrees + 'deg);'
                + '-moz-transform : rotate(' + degrees + 'deg);'
                + '-ms-transform : rotate(' + degrees + 'deg);'
                + '-o-transform : rotate(' + degrees + 'deg);'
                + 'transform : rotate(' + degrees + 'deg);');
        }
        for (var i in item.opps) {
            if (item.opps[i].renderIdx != null && item.opps[i].renderIdx != renderIdx) {
                if (item.opps[i].parentNode != null) {
                    item.opps[i].style.display = 'none';
                    //item.opps[i].parentNode.removeChild(item.opps[i]);
                    //item.opps[i] = null;
                }
            }
        }
    });
    host.appendTo(container);
    ohost.appendTo(container);
}

function isVisible(item) {
    item = item[0];
    while (item != null) {
        if (item.style != null && item.style.display == "none") {
            return false;
        }
        item = item.parentNode;
    }
    return true;
}

function CreateMessage(item, message) {
    var discardmessage = $("<div class='flex' style=';font-family: \"Segoe UI\"; font-size:13px;position:absolute;display:none;color:black;opacity:0.5'><span style='padding:2px 4px;display: inline-block;background: white;border-radius: 4px ;'>" + message + "</span></div>");
    discardmessage.width(item.Width);
    discardmessage.height(item.Height);
    discardmessage.css("justify-content", "center"); /* align horizontal */
    discardmessage.css("align-items", "center"); /* align vertical */

    return discardmessage;
}

function renderGeneratedStaticMapItem(item, container, dashboard) {
    var htmlcontainer = container.get(0);
    var host = $("<img class='noselect' style='position:absolute'></img>");
    var ohost = $("<div style='position:absolute;display:none'></div>");

    item.CurrentMapDiscarded = false;
    item.MapReady = true;
    var discardmessage = CreateMessage(item, "Waiting for map generation");
    var waitingmessage = CreateMessage(item, "Recording map, please do a valid timed lap");
    Wrap(item, "CurrentMapDiscarded", function (value) {
        discardmessage.toggle(value);
    });
    Wrap(item, "MapReady", function (value) {
        waitingmessage.toggle(!value);
    });

    item.opps = [];
    var renderIdx = 0;

    RegisterCustomData(dashboard, item, function (data) {
        if (data.PT == "mapurl") {
            maploaded = false;

            host.attr("src", data.MapUrl);
            host.width(data.Width);
            host.height(data.Height);
            host.get(0).style.marginTop = ((item.Height - data.Height) / 2) + "px";
            host.get(0).style.marginLeft = ((item.Width - data.Width) / 2) + "px";
            ohost.get(0).style.marginTop = ((item.Height - data.Height) / 2) + "px";
            ohost.get(0).style.marginLeft = ((item.Width - data.Width) / 2) + "px";
            ohost.width(data.Width);
            ohost.height(data.Height);
            ohost.toggle(data.MapUrl != null);
            host.toggle(data.MapUrl != null);
            return;
        }

        else if (data.PT == "opponnents") {
            renderIdx = (renderIdx + 1 % 100);

            for (var idx in data.Opponents) {
                opponent = data.Opponents[idx];
                var htmlopp = item.opps[opponent.Id];
                var style = opponent.IP ? item.PlayerStyle : item.OpponentStyle

                if (htmlopp == null) {
                    $htmlopp = $(document.createElement("div"));

                    $htmlopp.addClass("o" + opponent.Id);
                    $htmlopp.css("position", "absolute");
                    item.opps[opponent.Id] = $htmlopp.get(0);
                    htmlopp = $htmlopp.get(0);

                    if (opponent.IP) {
                        ApplyPlayerStyle($htmlopp, item.PlayerStyle, opponent, 999);
                    } else {
                        ApplyPlayerStyle($htmlopp, item.OpponentStyle, opponent, 1);
                    }

                    htmlopp.originalStyle = htmlopp.getAttribute('style');
                    $htmlopp.appendTo(ohost);
                }

                var colorStyle = GetPlayerColors($htmlopp, opponent, style);

                htmlopp.renderIdx = renderIdx;
                htmlopp.setAttribute('style', htmlopp.originalStyle + colorStyle + ";position:absolute;left:" + opponent.L + "px; top:" + opponent.T + "px");
                if (htmlopp.lasttextContent != opponent.RPT) {
                    htmlopp.textContent = opponent.RPT;
                    htmlopp.lasttextContent = opponent.RPT;
                }
            }
            for (var i in item.opps) {
                if (item.opps[i].renderIdx != renderIdx) {
                    if (item.opps[i].parentNode != null) {
                        item.opps[i].parentNode.removeChild(item.opps[i]);
                    }
                }
            }
        }
    });

    host.appendTo(container);
    discardmessage.appendTo(container);
    waitingmessage.appendTo(container);
    ohost.appendTo(container);
}

function renderGeneratedMapItem(item, container, dashboard) {
    var htmlcontainer = container.get(0);
    var radialCanvas = $("<canvas></canvas>");

    item.CurrentMapDiscarded = false;
    item.MapReady = true;
    var discardmessage = CreateMessage(item, "Waiting for map generation");
    var waitingmessage = CreateMessage(item, "Recording map, please do a valid timed lap");

    Wrap(item, "CurrentMapDiscarded", function (value) {
        discardmessage.toggle(value);
    });

    Wrap(item, "MapReady", function (value) {
        waitingmessage.toggle(!value);
        radialCanvas.toggle(value);
    });

    var pancontainer = $("<div  class='noselect' style='position:absolute;margin:1px'></div>");
    pancontainer.appendTo(container);

    item.opps = [];
    var renderIdx = 0;

    radialCanvas.css({ "position": "absolute" });
    radialCanvas.get(0).setAttribute("width", item.Width);
    radialCanvas.get(0).setAttribute("height", item.Height);
    var mapctx = radialCanvas.get(0).getContext('2d');

    radialCanvas.appendTo(pancontainer);

    discardmessage.appendTo(container);
    waitingmessage.appendTo(container);

    var mapImageCanvas = document.createElement('canvas');

    var mapworking = false;
    var maploaded = false;
    var lastorender = (new Date()).getTime() - 1000;
    var lastAf = 0;
    function drawmap() {
        try {
            mapctx.save();
            var opps = item.opps;

            mapctx.clearRect(0, 0, item.Width, item.Height);

            mapctx.scale(item.DisplayScale, item.DisplayScale);

            mapctx.translate(item.Width / 2 / item.DisplayScale, item.Height / 2 / item.DisplayScale);
            mapctx.rotate(Math.radians(item.rotationAngle));
            mapctx.translate(-item.ttX2, -item.ttY2);

            var diagonal = Math.sqrt(item.Width * item.Width + item.Height * item.Height) / item.DisplayScale;

            var sx = (item.ttX2 - diagonal / 2);
            var sy = (item.ttY2 - diagonal / 2);
            var swidth = diagonal;
            var sheight = diagonal;

            var x = (item.ttX2 - diagonal / 2);
            var y = (item.ttY2 - diagonal / 2);

            var width = diagonal;
            var height = diagonal;

            if (sx < 0) {
                x -= sx;
                sx = 0;
            }
            if (sy < 0) {
                y -= sy;
                sy = 0;
            }

            if (sy + sheight > mapImageCanvas.height) {
                sheight = mapImageCanvas.height - sy;
                height = sheight;
            }
            if (sx + swidth > mapImageCanvas.width) {
                swidth = mapImageCanvas.width - sx;
                width = swidth;
            }

            mapctx.drawImage(mapImageCanvas, sx, sy, swidth, sheight, x, y, width, height);

            for (var i in opps) {
                var opp = opps[i];
                if (!opp.IP) {
                    DrawPlayerStyle(mapctx, item.OpponentStyle, opp, item.rotationAngle);
                }
            }

            for (var i in opps) {
                var opp = opps[i];
                if (opp.IP) {
                    DrawPlayerStyle(mapctx, item.PlayerStyle, opp, item.rotationAngle);
                }
            }
        } catch (error) {
        }
        mapctx.restore();
        mapworking = false;
    }

    RegisterCustomData(dashboard, item, function (data) {
        if (data.PT == "mapurl") {
            maploaded = false;
            var mapImage = new Image();

            mapImageCanvasCtx = mapImageCanvas.getContext("2d");
            mapImageCanvasCtx.clearRect(0, 0, mapImageCanvas.width, mapImageCanvas.height);

            mapImage.onload = function () {
                mapImageCanvas.width = mapImage.naturalWidth;
                mapImageCanvas.height = mapImage.naturalHeight;
                mapImageCanvasCtx = mapImageCanvas.getContext("2d");
                mapImageCanvasCtx.drawImage(mapImage, 0, 0, mapImage.naturalWidth, mapImage.naturalHeight, 0, 0, mapImage.naturalWidth, mapImage.naturalHeight);
                maploaded = true;
                mapworking = false;
            }

            if (data.MapUrl != null) {
                mapImage.src = data.MapUrl;
            }
            return;
        }

        else if (data.PT == "opponnents") {
            if (maploaded && (!mapworking || lastorender < (new Date()).getTime() - 500)) {
                lastorender = (new Date()).getTime() - 1000;
                mapworking = true;

                item.opps = data.Opponents;
                drawmap();
            }
        }
    });
}

function renderCircularGaugeItem(item, container, dashboard) {
    var c2 = $("<div class='dialcontainer'></div>");
    c2.appendTo(container);

    var itemWidth = Math.min(item.Width, item.Height);
    var itemHeight = Math.min(item.Width, item.Height);
    var radialCanvas = $("<canvas></canvas>");

    var bgCanvas = $("<canvas></canvas>").get(0);
    bgCanvas.setAttribute("width", itemWidth);
    bgCanvas.setAttribute("height", itemHeight);
    var bgContext = bgCanvas.getContext('2d');

    var fgCanvas = $("<canvas></canvas>").get(0);
    fgCanvas.setAttribute("width", itemWidth);
    fgCanvas.setAttribute("height", itemHeight);
    var fgContext = fgCanvas.getContext('2d');

    // Background image
    var bgPattern = null;
    // Fill image
    var fgPattern = null;

    radialCanvas.css({ "position": "absolute" });

    var radialctx = radialCanvas.get(0).getContext('2d');
    radialCanvas.appendTo(c2);

    item.ValueEx = 0;
    function refreshRadial() {
        var itemWidth = Math.min(item.Width, item.Height);
        var itemHeight = Math.min(item.Width, item.Height);

        radialCanvas.get(0).setAttribute("width", itemWidth);
        radialCanvas.get(0).setAttribute("height", itemHeight);

        radialctx.clearRect(0, 0, itemWidth, itemHeight);

        radialctx.save();
        radialctx.lineWidth = Math.min(item.StrokeThickness, itemWidth / 2);

        radialctx.beginPath();
        radialctx.arc(Math.round(itemWidth / 2), Math.round(itemHeight / 2), Math.max(0, Math.round(itemHeight / 2 - radialctx.lineWidth / 2) - 1),
            Math.radians(item.MinAngle - 90), Math.radians(item.MaxAngle - 90), false);

        if (bgPattern == null) {
            radialctx.strokeStyle = hex2rgba(item.CircleGaugeBackgroundColor);
        } else {
            radialctx.strokeStyle = bgPattern;
        }
        radialctx.stroke();

        radialctx.beginPath();
        radialctx.arc(Math.round(itemWidth / 2), Math.round(itemHeight / 2), Math.max(0, Math.round(itemHeight / 2 - radialctx.lineWidth / 2) - 1),
            Math.radians(item.MinAngle - 90), Math.radians(item.MinAngle + item.ValueEx - 90), false)

        if (fgPattern == null) {
            radialctx.strokeStyle = hex2rgba(item.CircleGaugeColor);
        } else {
            radialctx.strokeStyle = fgPattern;
        }
        radialctx.stroke();
        radialctx.restore();
    }

    var t = Wrap(item, "CircleGaugeImage", function () {
        var itemWidth = Math.min(item.Width, item.Height);
        var itemHeight = Math.min(item.Width, item.Height);
        if (item.CircleGaugeImage != null) {
            fgCanvas.setAttribute("width", itemWidth);
            fgCanvas.setAttribute("height", itemHeight);

            var image = new Image();
            image.onload = function () {
                fgContext.drawImage(image, 0, 0, image.width, image.height, 0, 0, itemWidth, itemHeight);
                fgPattern = radialctx.createPattern(fgCanvas, "no-repeat");
                refreshRadial();
            };
            image.src = GetImage(item.CircleGaugeImage, dashboard, true);
        } else {
            fgPattern = null;
        }
    })
    t.addDependantProperties("Height", "Width");

    Wrap(item, "CircleGaugeBackgroundImage", function () {
        var itemWidth = Math.min(item.Width, item.Height);
        var itemHeight = Math.min(item.Width, item.Height);
        if (item.CircleGaugeBackgroundImage != null) {
            bgCanvas.setAttribute("width", itemWidth);
            bgCanvas.setAttribute("height", itemHeight);

            var image = new Image();
            image.onload = function () {
                bgContext.drawImage(image, 0, 0, image.width, image.height, 0, 0, itemWidth, itemHeight);
                bgPattern = radialctx.createPattern(bgCanvas, "no-repeat");
                refreshRadial();
            };
            image.src = GetImage(item.CircleGaugeBackgroundImage, dashboard, true);
        } else {
            bgPattern = null;
        }
    }).addDependantProperties("Height", "Width");

    Wrap(item, "ValueEx", function (value) {
        requestAnimationFrameEx(refreshRadial);
    }).addDependantProperties("StrokeThickness", "CircleGaugeColor", "CircleGaugeBackgroundColor", "MinAngle", "MaxAngle", "Width", "Height");
}

function renderArcGaugeItem(item, container, dashboard) {
    item.ValueSweep = 0;

    var c2 = $("<div class='dialcontainer'></div>");
    c2.appendTo(container);

    var sizedSVG = new SizedSVG(c2.get(0), {
        width: item.Width, height: item.Height
    });

    function GetOrientedSweep() {
        return item.SweepAngle * (item.SweepAngleCounterClockWise ? -1 : 1);
    }

    function GetBackgroundOptions(startAngle, sweepAngle) {
        return {
            width: item.Width, height: item.Height, arcThickness: item.ArcThickness,
            startAngle: startAngle,
            sweepAngle: sweepAngle,
            arcColor: hex2rgba(item.SweepBackgroundColor),
            imageSrc: GetImage(item.SweepBackgroundImage, dashboard, true), // Uncomment to use an image.
            visible: true,
            isEllipse: item.UseEllipse
        };
    };

    function GetCompleteCircleOptions(startAngle, sweepAngle) {
        return {
            width: item.Width, height: item.Height, arcThickness: item.ArcThickness,
            startAngle: startAngle,
            sweepAngle: sweepAngle,
            arcColor: hex2rgba(item.CompleteCircleColor),
            imageSrc: GetImage(item.CompleteCircleImage, dashboard, true), // Uncomment to use an image.
            visible: item.CompleteCircleEnabled,
            isEllipse: item.UseEllipse
        };
    };

    function GetSweepOptions(startAngle, sweepAngle) {
        return {
            width: item.Width, height: item.Height, arcThickness: item.ArcThickness,
            startAngle: startAngle,
            sweepAngle: sweepAngle,
            arcColor: hex2rgba(item.SweepColor),
            imageSrc: GetImage(item.SweepImage, dashboard, true), // Uncomment to use an image.
            visible: true,
            isEllipse: item.UseEllipse
        };
    };
    var completeCircleSVG = new ArcSVG(sizedSVG.getSVG(), GetCompleteCircleOptions(item.SweepStartAngle, 0));
    var backGroundArcSVG = new ArcSVG(sizedSVG.getSVG(), GetBackgroundOptions(item.SweepStartAngle, GetOrientedSweep()));
    var sweepSVG = new ArcSVG(sizedSVG.getSVG(), GetSweepOptions(item.SweepStartAngle, 0));

    function updateCircularGauge() {
        var backgroundStartAngle = item.SweepStartAngle + item.ValueSweep;
        var backgroundSweep = GetOrientedSweep() - item.ValueSweep;

        sizedSVG.updateOptions({ width: item.Width, height: item.Height });
        backGroundArcSVG.updateOptions(GetBackgroundOptions(backgroundStartAngle, backgroundSweep));
        sweepSVG.updateOptions(GetSweepOptions(item.SweepStartAngle, item.ValueSweep));
        completeCircleSVG.updateOptions(GetCompleteCircleOptions(item.SweepStartAngle, item.CompleteCircleSweep));
    }
    WrapNoInit(item, "ValueSweep", function (value) {
        // Update only once !
        RegisterPostModelUpdateCallback(item, function () { updateCircularGauge(); });
    }).addDependantProperties(
        "ArcThickness",
        "SweepColor", "SweepBackgroundColor", "CompleteCircleColor",
        "SweepImage", "SweepBackgroundImage", "CompleteCircleImage",
        "SweepStartAngle", "SweepAngle", "SweepCounterClockWise",
        "Width", "Height",
        "SweepStartAngle", "UseEllipse",
        "CompleteCircleSweep", "CompleteCircleEnabled");

    Wrap(item, "BorderStyle", function (value) {
        AntiMargin(c2, item.BorderStyle);
    });
}
function renderDialGauge(item, container, dashboard) {
    var c2 = $("<div class='dialcontainer'></div>");

    c2.appendTo(container);

    //var mRadius = Math.max(item.Width, item.Height);
    var itemWidth = item.OuterRadius * 2;
    var itemHeight = item.OuterRadius * 2;

    c2.css("margin-top", Math.max(0, (item.Height - (item.OuterRadius * 2)) / 2) + "px");
    c2.css("margin-left", Math.max(0, (item.Width - (item.OuterRadius * 2)) / 2) + "px");

    var backgroundHost = $("<div class='centerbg'></div>");
    AntiMargin(backgroundHost, item.BorderStyle);
    backgroundHost.width(itemWidth);
    backgroundHost.height(itemHeight);
    backgroundHost.css({ "position": "absolute" });

    var tickHost = $("<div class='centerbg'></div>");
    AntiMargin(tickHost, item.BorderStyle);
    tickHost.width(itemWidth);
    tickHost.height(itemHeight);
    tickHost.css({ "position": "absolute" });

    var glassHost = $("<div class='centerbg'></div>");
    AntiMargin(glassHost, item.BorderStyle);
    glassHost.width(itemWidth);
    glassHost.height(itemHeight);
    glassHost.css({ "position": "absolute" });

    var caphost = $("<div class='caphost'></div>");
    caphost.css({ "position": "absolute" });

    caphost.css("margin-top", (itemHeight - (item.CapRadius)) / 2 + "px");
    caphost.css("margin-left", (itemWidth - (item.CapRadius)) / 2 + "px");
    caphost.css({ "position": "absolute" });
    caphost.css("box-sizing", "border-box");

    var optimalCanvas = $("<canvas></canvas>");
    optimalCanvas.css({ "position": "absolute" });
    optimalCanvas.get(0).setAttribute("width", itemWidth);
    optimalCanvas.get(0).setAttribute("height", itemHeight);
    var optimalctx = optimalCanvas.get(0).getContext('2d');

    var radialCanvas = $("<canvas></canvas>");
    radialCanvas.css({ "position": "absolute" });
    radialCanvas.get(0).setAttribute("width", itemWidth);
    radialCanvas.get(0).setAttribute("height", itemHeight);
    var radialctx = radialCanvas.get(0).getContext('2d');

    var needleCanvas = $("<canvas></canvas>");
    needleCanvas.css({ "position": "absolute" });
    needleCanvas.get(0).setAttribute("width", itemWidth);
    needleCanvas.get(0).setAttribute("height", itemHeight);

    var needleTmp = null;
    var needleTmpCtx = null;

    var needlectx = needleCanvas.get(0).getContext('2d');
    var needleYOffset = 0;
    var forceNeedleClear = false;
    function UpdateNeedleSource() {
        if (item.NeedleImage != null && item.NeedleImage != 'None') {
            var needleImage = new Image();
            needleImage.onload = function () {
                needleTmp = document.createElement('canvas');

                needleTmp.width = item.NeedleLength;
                needleTmp.height = Math.round(item.NeedleLength / needleImage.naturalWidth * needleImage.naturalHeight);

                if (item.NeedleOffset >= 0) {
                    needleTmpCtx = needleTmp.getContext("2d");
                    needleTmpCtx.drawImage(needleImage,
                        0, 0, needleImage.naturalWidth - item.NeedleOffset / item.NeedleLength * needleImage.naturalWidth, needleImage.naturalHeight,
                        item.NeedleOffset,//target X
                        0, //target Y
                        item.NeedleLength - item.NeedleOffset, // Width
                        needleTmp.height);//Math.round((item.NeedleLength - item.NeedleOffset) / needleImage.naturalWidth * needleImage.naturalHeight));

                    needleXOffset = 0;
                } else {
                    needleTmpCtx = needleTmp.getContext("2d");
                    needleTmpCtx.drawImage(needleImage,
                        0, 0, needleImage.naturalWidth, needleImage.naturalHeight,
                        0,//target X
                        0, //target Y
                        item.NeedleLength, // Width
                        needleTmp.height);

                    needleXOffset = item.NeedleOffset;
                }
                needleYOffset = -needleTmp.height / 2;
                forceNeedleClear = true;
                refreshNeedle();
            };
            needleImage.src = GetImage(item.NeedleImage, dashboard, true);
        } else {
            needleTmp = document.createElement('canvas');
            needleTmp.width = item.NeedleLength;
            needleTmp.height = item.NeedleThickness;
            needleTmpCtx = needleTmp.getContext("2d");

            //var p = new Path2D('M1,1 L1,10 L156,6 L156,4 z');
            var p = new Path2D('M1,1 L1,' + Math.round(item.NeedleThickness - 2) + ' L' + Math.round(item.NeedleLength - 2)
                + ',' + Math.round(item.NeedleThickness * 6 / 10) + ' L' + (item.NeedleLength - 2) + ',' + Math.round(item.NeedleThickness * 4 / 10) + ' z');

            //needleTmpCtx.scale(item.NeedleLength / 158, item.NeedleThickness / 12);
            needleYOffset = -item.NeedleThickness / 2;
            needleTmpCtx.fillStyle = 'red';
            var grd = needleTmpCtx.createLinearGradient(0, 0, 0, item.NeedleThickness);
            grd.addColorStop(0.197, hex2rgba("#FF890A0A"));
            grd.addColorStop(0.610, hex2rgba("#FFE32323"));
            grd.addColorStop(1, hex2rgba("#FFC40808"));
            needleTmpCtx.fillStyle = grd;

            needleTmpCtx.strokeStyle = hex2rgba("#FFE91C1C");
            needleTmpCtx.trokeThickness = 2;

            needleTmpCtx.fill(p);
            needleTmpCtx.stroke(p);
            needleXOffset = 0;
            forceNeedleClear = true;
        }
    }

    Wrap(item, "NeedleImage", UpdateNeedleSource)
        .addDependantProperties("NeedleLength", "NeedleOffset", "NeedleThickness")

    backgroundHost.appendTo(c2);
    optimalCanvas.appendTo(c2);

    if (item.ShowRadialGauge) {
        radialCanvas.appendTo(c2);
    }
    tickHost.appendTo(c2);

    var cap = $("<div class='pointercap'><div class='insidecap'></div></div>")
    var insidecap = $(".insidecap", cap);
    Wrap(item, "CapRadius", function () {
        caphost.css("margin-top", (itemHeight - (item.CapRadius)) / 2 + "px");
        caphost.css("margin-left", (itemWidth - (item.CapRadius)) / 2 + "px");

        cap.css("width", (item.CapRadius) + "px");
        cap.css("height", (item.CapRadius) + "px");

        insidecap.css("width", (item.CapRadius - 8) + "px");
        insidecap.css("height", (item.CapRadius - 8) + "px");

        cap.appendTo(caphost);
    });

    var showneedle = item.ShowNeedle;
    if (item.ShowNeedle && (item.NeedleImage == null || item.NeedleImage != "")) {
        showneedle = true;
        needleCanvas.appendTo(c2);
    }

    if (item.CapRadius > 0) {
        caphost.appendTo(c2);
    }

    glassHost.appendTo(c2);

    var glass = $('<div class="centerbg dialbackhost" style=" display:none;   -webkit-mask-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAA5JREFUeNpiYGBgAAgwAAAEAAGbA+oJAAAAAElFTkSuQmCC); margin: 0px; width: 526px; height: 526px; position: absolute;background-position: center center; border-radius:50% 50% ;overflow:hidden"><div class="centerbg" style="top:262px;margin: 0px; width: 700px; height: 400px; position: absolute;background-position: center center; background:rgba(255,255,255,0.12); border-radius:50% 50%"></div></div>');
    glass.css("width", itemWidth + "px");
    glass.css("height", itemHeight + "px");

    //glass.show();
    glass.children().first().css("width", (itemWidth * 7 / 5) + "px");
    glass.children().first().css("height", itemWidth + "px");
    //glass.css("top", "0px");
    glass.children().first().css("top", itemHeight / 2 + "px");

    glass.appendTo(c2);

    Wrap(item, "ShowDialGlassEffect", function (value) {
        glass.toggle(value);
    });

    item.CurrentAngle = item.StartAngle;
    var lastNeedleAngle = -9999;
    var needleXOffset = 0;
    var lastrender = 0;
    var naf = 0;
    var lastRequest = 0;

    function refreshNeedle() {
        naf = 0;

        var newangle = item.CurrentAngle;

        if (lastNeedleAngle == -9999) {
            lastNeedleAngle = newangle - 1;
        }

        var diff = newangle - lastNeedleAngle;

        newdelta = Math.max(Math.min(4, Math.pow(diff / 4, 2) * Math.sign(diff)), -4);//4 : 0.5;
        //newdelta = diff > 0 ? 4 : -4;

        var minspeed = 0.7;
        if (newdelta < 0 && newdelta > -minspeed) { newdelta = -minspeed }
        if (newdelta > 0 && newdelta < minspeed) { newdelta = minspeed }

        if (lastrender != 0) {
            var pnow = performance.now();
            var td = (pnow - lastrender);
            if (td < 50 && td > 5) {
                var rate = td / (500.0 / 60.0);
                newdelta = newdelta * rate;
            }
        }

        var delta = newdelta;

        var angle = lastNeedleAngle + delta;

        if (lastNeedleAngle <= newangle && angle >= newangle) {
            angle = newangle;
        } else if (lastNeedleAngle >= newangle && angle <= newangle) {
            angle = newangle;
        }

        if (showneedle) {
            var drawoversize = 2

            if (needleTmp != null) {
                if (forceNeedleClear) {
                    needlectx.clearRect(0, 0, needleCanvas.width(), needleCanvas.height());
                    forceNeedleClear = false;
                }

                needlectx.save();
                needlectx.translate(Math.round(itemWidth / 2), Math.round(itemHeight / 2));
                {
                    needlectx.save();
                    needlectx.rotate(Math.radians(lastNeedleAngle));
                    needlectx.translate(needleXOffset, needleYOffset);
                    needlectx.clearRect(-drawoversize, -drawoversize, needleTmp.width + drawoversize * 2, needleTmp.height + drawoversize * 2);
                    needlectx.restore();
                }
                needlectx.rotate(Math.radians(angle));
                needlectx.translate(needleXOffset, needleYOffset);

                needlectx.drawImage(needleTmp, 0, 0);
                needlectx.restore();
            }
        }

        if (item.ShowRadialGauge) {
            radialctx.clearRect(0, 0, itemWidth, itemHeight);
            radialctx.save();
            radialctx.lineWidth = item.RadialGaugeThickness;
            radialctx.beginPath();
            var radialStartAngle = item.StartAngle + item.RadialGaugeStartOffset;
            var radialEndAngle = angle;
            if (radialStartAngle > radialEndAngle) {
                var tmp = radialStartAngle;
                radialStartAngle = radialEndAngle;
                radialEndAngle = tmp;
            }
            radialctx.arc(Math.round(itemWidth / 2), Math.round(itemHeight / 2), Math.max(0, Math.round(item.RadialGaugeRadius + item.RadialGaugeThickness / 2) - 1),
                Math.radians(radialStartAngle), Math.radians(radialEndAngle), false);
            radialctx.strokeStyle = hex2rgba(item.RadialGaugeColor);
            radialctx.stroke();
            radialctx.restore();
        }

        lastNeedleAngle = angle;

        if (angle != newangle || delta > 0) {
            naf = window.requestAnimationFrame(refreshNeedle);
            lastrender = performance.now();
        } else {
            lastrender = 0;
        }
    }

    function drawArc(ctx, startAngle, endAngle, radius, thickness, color) {
        if (startAngle == endAngle) {
            return;
        }
        if (startAngle > endAngle) {
            var tmp = startAngle;
            startAngle = endAngle;
            endAngle = tmp;
        }

        if (thickness == 0) {
            return;
        }
        optimalctx.lineWidth = thickness;
        optimalctx.beginPath();
        optimalctx.strokeStyle = hex2rgba(color);
        var isReflexAngle1 = Math.abs(endAngle - startAngle) > 180.0;

        optimalctx.arc(Math.round(itemWidth / 2), Math.round(itemHeight / 2),
            Math.max(0, Math.round(radius + thickness / 2) - 1),
            Math.radians(startAngle), Math.radians(endAngle), false);
        optimalctx.stroke();
    }

    function refreshOptimal() {
        var MaxValue = item.Maximum;
        var MinValue = item.Minimum;
        var ScaleSweepAngle = item.SweepAngle;
        var gaugeStartAngle = item.StartAngle;
        var OptimalRangeStartValue = item.RangeOptimalStartValue;
        var OptimalRangeEndValue = item.RangeOptimalEndValue;

        var realworldunit = (ScaleSweepAngle / (MaxValue - MinValue));
        optimalRangeStartValue = Math.max(OptimalRangeStartValue, MinValue);
        OptimalRangeEndValue = Math.min(OptimalRangeEndValue, MaxValue);

        var optimalRangeStartValueRelative = optimalRangeStartValue - MinValue;
        var optimalStartAngle = ((optimalRangeStartValueRelative * realworldunit));
        var optimalStartAngleFromStart = (gaugeStartAngle + optimalStartAngle);

        var optimalRangeEndValueRelative = OptimalRangeEndValue - MinValue;
        var optimalEndAngle = ((optimalRangeEndValueRelative * realworldunit));
        var optimalEndAngleFromStart = (gaugeStartAngle + optimalEndAngle);

        // calculating the angle for optimal Start value
        var gaugeEndAngle = gaugeStartAngle + ScaleSweepAngle;

        optimalctx.clearRect(0, 0, itemWidth, itemHeight);
        optimalctx.save();

        drawArc(optimalctx, optimalStartAngleFromStart, optimalEndAngleFromStart, item.RangeIndicatorRadius, item.RangeIndicatorThickness, item.OptimalStyle.ArcColor);
        drawArc(optimalctx, item.StartAngle, optimalStartAngleFromStart, item.RangeIndicatorRadius, item.RangeIndicatorThickness, item.BelowOptimalStyle.ArcColor);
        drawArc(optimalctx, optimalEndAngleFromStart, gaugeEndAngle, item.RangeIndicatorRadius, item.RangeIndicatorThickness, item.AboveOptimalStyle.ArcColor);

        optimalctx.restore();
    }

    WrapNoInit(item, "OptimalStyle", function (value) {
        requestAnimationFrameEx(refreshOptimal);
    }).addDependantProperties(
        "BelowOptimalStyle",
        "AboveOptimalStyle",
        "RangeOptimalStartValue",
        "RangeOptimalEndValue",
        "Minimum",
        "Maximum",
        "SweepAngle",
        "StartAngle");

    refreshOptimal();

    WrapNoInit(item, "CurrentAngle", function (value) {
        if (isVisible(container)) {
            if (showneedle || item.ShowRadialGauge) {
                // delta = 0;
                if (naf === 0) {
                    requestAnimationFrameEx(refreshNeedle);
                }
            }
        }
    });

    if (showneedle || item.ShowRadialGauge) {
        requestAnimationFrameEx(refreshNeedle);
    }

    RegisterCustomData(dashboard, item, function (data) {
        if (data['GH'] != undefined) {
            backgroundHost.addClass(GetDynamicImageClassFromURL("backgroundHost" + item.uid, data.GH));
            backgroundHost.get(0).style.backgroundPosition = "center";
        }

        if (data['DH'] != undefined) {
            tickHost.addClass(GetDynamicImageClassFromURL("tickHost" + item.uid, data.DH));
            tickHost.get(0).style.backgroundPosition = "center";
        }

        if (data['Glass'] != undefined) {
            glassHost.addClass(GetDynamicImageClassFromURL("glassHost" + item.uid, data.Glass));
            glassHost.get(0).style.backgroundPosition = "center";
        }
    });
}

function renderWidgetItem(item, container, dashboard, parentTask) {
    var content = $(document.createElement("div"));

    function renderWidgetContent(parentTask) {
        item.FileName = DefaultValue(item.FileName, null);
        container.attr("widgetsource", item.FileName);

        if (item.FileName !== null && item.FileName != "") {
            new FakeTask(parentTask)
                .setName("WidgetRender")
                .onComplete(function () {
                    //console.log("widget rendering done");
                })
                .onRun(function (task) {
                    LoadTemplate(task, dashboard.templateName, item.FileName, content, true, item, item.uid, false, item.FreezePageChanges == true ? item.InitialScreenIndex : null);
                })
                .start();

            content.width(item.Width);
            content.height(item.Height);
            content.css("transform", "scale(" + item.AutoSizeScale + ")");
            content.css("transform-origin", "top left");
            AntiMargin(content, item.BorderStyle);
        }
    }

    renderWidgetContent(parentTask);

    WrapNoInit(item, "AutoSizeScale", function () {
        content.width(item.Width);
        content.height(item.Height);
        content.css("transform", "scale(" + item.AutoSizeScale + ")");
        content.css("transform-origin", "top left");
    }).addDependantProperties("Width", "Height");

    content.appendTo(container);

    WrapNoInit(item, "WidgetChange", function (value, updateTask) {
        // Delete old content
        $(".dash-item", content).each(function (element) {
            UnWrap($(this).attr("data-uid"));
        });

        // Empty it
        content.html("");

        item.FileName = value.FileName;

        new FakeTask(updateTask)
            .onRun(function (task) {
                renderWidgetContent(task);
            })
            .start();
    });
}

function renderIntegratedLedItem(item, container, dashboard) {
    var content = $("<div style='margin:15px' class='ledhost'></div>");

    var bg = '<svg width="80" height="80" viewbox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><circle fill="#808080" stroke="#A9A9A9" stroke-width="10" cx="40" cy="40" r="35" id="svg_1" /></svg>';
    var fg = '<svg width="80" height="80" viewbox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><circle fill="#FF0000" class="innercolor" cx="40" cy="40" r="40" id="svg_1" /></svg>';
    var fgcenter = '<svg width="80" height="80" viewbox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><circle fill="#FF0000" class="innercolor" cx="40" cy="40" r="30" id="svg_1" /></svg>';

    function createLed(idx, svgcontent) {
        if (item.Vertical) {
            return createLedVertical(idx, svgcontent);
        } else {
            return createLedHorizontal(idx, svgcontent);
        }
    }

    function createLedHorizontal(idx, svgcontent) {
        var ledcontainer = $("<div class='ledcontainer'>" + svgcontent + "</div>");
        ledcontainer.width((item.Width - 30) / item.LedCount);
        ledcontainer.css("left", 15 + (item.Width - 30) / item.LedCount * idx);
        if (item.Height - 30 < (item.Width - 30) / item.LedCount) {
            $("svg", ledcontainer).height(item.Height - 30);
        }
        else {
            $("svg", ledcontainer).width((item.Width - 30) / item.LedCount);
        }

        $("svg", ledcontainer).css("padding", "0 " + item.MinimumLedSpacing + "px");
        return ledcontainer;
    }

    function createLedVertical(idx, svgcontent) {
        var ledcontainer = $("<div class='ledcontainer'>" + svgcontent + "</div>");
        ledcontainer.height((item.height - 30) / item.LedCount);
        ledcontainer.css("top", 15 + (item.Height - 30) / item.LedCount * idx);
        if (item.Width - 30 < (item.Height - 30) / item.LedCount) {
            $("svg", ledcontainer).width(item.Width - 30);
        }
        else {
            $("svg", ledcontainer).height((item.Height - 30) / item.LedCount);
        }

        $("svg", ledcontainer).css("padding", item.MinimumLedSpacing + "px 0");
        return ledcontainer;
    }

    var bgleds = [];
    var fgleds = [];
    var fgcenterleds = [];

    for (var j = 0; j < item.LedCount; j++) {
        var bgled = createLed(j, bg);
        bgled.appendTo(content);
        bgleds[j] = bgled;
    }

    for (var j = 0; j < item.LedCount; j++) {
        var fgled = createLed(j, fg);
        fgled.css("filter", "blur(15px)");
        fgled.hide();
        fgled.appendTo(content);
        fgleds[j] = fgled;
    }

    for (var j = 0; j < item.LedCount; j++) {
        var fgcenterled = createLed(j, fgcenter);
        fgcenterled.appendTo(content);
        fgcenterled.hide();
        fgcenterleds[j] = fgcenterled;
    }

    content.width(item.Width - 30);
    content.height(item.Height - 30);
    content.appendTo(container);

    RegisterCustomData(dashboard, item, function (data) {
        for (var i = 0; i < data.length; i++) {
            var ldata = data[i];
            var lindex = ldata.I;

            if (!item.Vertical) {
                $("svg", fgleds[lindex])[0].style["margin-top"] = Math.trunc(ldata.M) + "px";
                $("svg", fgcenterleds[lindex])[0].style["margin-top"] = ldata.M + "px";
                $("svg", bgleds[lindex])[0].style["margin-top"] = ldata.M + "px";
            }
            if (ldata.A) {
                $(".innercolor", fgleds[lindex]).attr("fill", ldata.C);
                $(".innercolor", fgcenterleds[lindex]).attr("fill", ldata.C);

                fgleds[lindex].show();
                fgcenterleds[lindex].show();
            } else {
                fgleds[lindex].hide();
                fgcenterleds[lindex].hide();
            }
        }
    });
}

function renderEllipseItem(item, container, dashboard) {
    var content = $("<div></div>");

    content.css("box-sizing", "border-box");
    content.get(0).style.borderRadius = "50% 50%";

    content.width(item.Width);
    content.height(item.Height);

    Wrap(item, "EllipseThickness", function (value) {
        content.get(0).style.borderWidth = (value) + "px";
        //content.get(0).style.borderColor = hex2rgba(value);
    });
    Wrap(item, "EllipseBackbroundImage", function (value) {
        SetImage(content, value, dashboard);
        content.get(0).style.backgroundSize = item.Width + 'px ' + item.Height + 'px';
    });

    Wrap(item, "FillColor", function (value) {
        SetImage(content, value, dashboard);
        content.get(0).style.backgroundColor = hex2rgba(value);
    });

    Wrap(item, "EllipseColor", function (value) {
        SetImage(content, value, dashboard);
        content.get(0).style.borderStyle = 'solid';
        content.get(0).style.borderColor = hex2rgba(value);
    });

    Wrap(item, "EllipseBackgroundImage", function (value) {
        SetImage(content, value, dashboard);
        //content.get(0).style.borderStyle = 'solid';
        //content.get(0).style.borderColor = hex2rgba(value);
    });

    content.appendTo(container);
}

function renderWebPageItem(item, container, dashboard) {
    var content = $("<iframe loading='lazy'></iframe>");

    Wrap(item, "ClickThrough", function (value) {
        if (!value) {
            content.css("pointer-events", "auto");
        } else {
            content.css("pointer-events", null);
        }
    });

    AntiMargin(content, item.BorderStyle);

    Wrap(item, "Width", function (value) {
        content.width(value);
    });

    Wrap(item, "Height", function (value) {
        content.height(value);
    });

    Wrap(item, "StartAddress", function (value) {
        content.attr("src", value);
    });

    content.appendTo(container);
}

function renderImageItem(item, container, dashboard) {
    var content = $(document.createElement("div"));
    AntiMargin(content, item.BorderStyle);

    Wrap(item, "Width", function (value) {
        content.width(value);
    });

    Wrap(item, "Height", function (value) {
        content.height(value);
    });

    Wrap(item, "Image", function (value) {
        SetImage(content, value, dashboard);
        content.get(0).style.backgroundSize = item.Width + 'px ' + item.Height + 'px';
    }).addDependantProperties("Width", "Height");

    content.appendTo(container);
}
function renderAnimatedGifItem(item, container, dashboard) {
    var content = $(document.createElement("img"))
        .css("object-fit", "contain");

    AntiMargin(content, item.BorderStyle);

    Wrap(item, "Width", function (value) {
        content.css("width", value + "px");
    });

    Wrap(item, "Height", function (value) {
        content.css("height", value + "px");
    });

    Wrap(item, "GifPath", function (value) {
        if (value === "" || value == null) {
            content.hide();
        } else {
            content.attr("src", value);
            content.show();
        }
    });

    content.appendTo(container);
}

function renderImageFromFileItem(item, container, dashboard) {
    var content = $(document.createElement("img"))
        .css("object-fit", "contain");

    AntiMargin(content, item.BorderStyle);

    Wrap(item, "Width", function (value) {
        content.css("width", value + "px");
    });

    Wrap(item, "Height", function (value) {
        content.css("height", value + "px");
    });

    content.hide();
    RegisterCustomData(dashboard, item, function (data) {
        if (data === "") {
            content.hide();
        } else {
            content.attr("src", data);
            content.show();
        }
    });

    content.appendTo(container);
}

function renderToggleImageItem(item, container, dashboard) {
    var contentOn = $("<div style='position:absolute'></div>");
    AntiMargin(contentOn, item.BorderStyle);

    var contentOff = $("<div style='position:absolute'></div>");
    AntiMargin(contentOff, item.BorderStyle);

    Wrap(item, "OnImage", function (value) {
        SetImage(contentOn, value, dashboard);
    });

    Wrap(item, "OffImage", function (value) {
        SetImage(contentOff, value, dashboard);
    });

    Wrap(item, "Width", function (value) {
        contentOn.width(value);
        contentOff.width(item.Width);
        contentOn.get(0).style.backgroundSize = item.Width + 'px ' + item.Height + 'px';
        contentOff.get(0).style.backgroundSize = item.Width + 'px ' + item.Height + 'px';
    });

    Wrap(item, "Height", function (value) {
        contentOn.height(value);
        contentOff.height(item.Height);
        contentOn.get(0).style.backgroundSize = item.Width + 'px ' + item.Height + 'px';
        contentOff.get(0).style.backgroundSize = item.Width + 'px ' + item.Height + 'px';
    });

    var htmlContentOn = contentOn.get(0);

    var htmlContentOff = contentOff.get(0);

    Wrap(item, "Value", function (value) {
        if (value) {
            htmlContentOn.style.display = "block";

            if (!item.StackImagesWhenOn) {
                htmlContentOff.style.display = "none";
            } else {
                htmlContentOff.style.display = "block";
            }
        } else {
            htmlContentOn.style.display = "none";
            htmlContentOff.style.display = "block";
        }
    });

    contentOff.appendTo(container);
    contentOn.appendTo(container);
}

function vibrate(vibrationDelay) {
    if (!window) {
        return;
    }

    if (!window.navigator) {
        return;
    }

    if (!window.navigator.vibrate) {
        return;
    }

    window.navigator.vibrate(vibrationDelay);
}

function renderButtonItem(item, container, dashboard, templateInstanceUid, currentrepetition, parentTask) {
    //console.log(item);
    var content = $("<div style=\"    background-size: contain;    background-repeat: no-repeat;background-position: center\"></div>");
    content.css("pointer-events", "auto");
    content.css("-webkit-app-region", "no-drag");

    Wrap(item, "Image", function (value) {
        SetImage(content, value, dashboard);
        content.get(0).style.backgroundSize = 'contain';
    });

    function SetCurrentButtonImage(pressed) {
        $(this).data('down', pressed);

        if (!item.IsEnabled) {
            SetImage(content, item.Image, dashboard);
            content.css("opacity", item.DisabledOpacity / 100);
            container.addClass("disabled");
        } else {
            if (!pressed) {
                SetImage(content, item.Image, dashboard);
                content.css("opacity", "");
            } else {
                var image = item.PressedImage;

                if (item.PressedImage == null || !(typeof item.PressedImage != 'undefined'))
                    image = item.Image;

                SetImage(content, image, dashboard);
                content.css("opacity", item.PressedOpacity / 100);
            }

            container.removeClass("disabled");
        }

        renderGroup(item, container, dashboard, templateInstanceUid, currentrepetition, parentTask)
    }

    Wrap(item, "IsEnabled", function (value) {
        SetCurrentButtonImage(false);
    });

    AntiMargin(content, item.BorderStyle);

    Wrap(item, "Width", function (value) {
        content.width(value);
    });

    Wrap(item, "Height", function (value) {
        content.height(value);
    });

    content.appendTo(container);

    var isTouchDevice = (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0));

    content.click(function (ev) {
        SendComponentMessage(dashboard, item, "clicked", false);
        ev.preventDefault();
    });

    var pressed = false;

    var state = false;
    var isMomentary = item.ButtonStyle == 0;

    function toggleState() {
        state = !state;
        SetCurrentButtonImage(state);
    }

    var pressFunction = function () {
        if (!pressed) {
            pressed = true;
            SendComponentMessage(dashboard, item, "pressed", false);
            if (!isMomentary) {
                toggleState();
            } else {
                SetCurrentButtonImage(true);
            }
        }
    }

    var releaseFunction = function () {
        if (pressed) {
            pressed = false;
            SendComponentMessage(dashboard, item, "released", false);
            if (!isMomentary) {
                //toggleState();
            } else {
                SetCurrentButtonImage(false);
            }
        }
    }

    content.mousedown(function (ev) {
        pressFunction();
        ev.preventDefault();
        ev.stopImmediatePropagation();
    });

    content.mouseleave(function (ev) {
        releaseFunction();
        ev.stopImmediatePropagation();
        ev.preventDefault();
    });

    content.mouseup(function (ev) {
        releaseFunction();
        ev.stopImmediatePropagation();
        ev.preventDefault();
    });

    content.bind('touchstart', function (ev) {
        pressFunction();
        ev.preventDefault();
        ev.stopImmediatePropagation();
    });

    content.bind('touchend', function (ev) {
        releaseFunction();
        ev.stopImmediatePropagation();
        ev.preventDefault();
    });
}

function renderGradientItem(item, container, dashboard) {
    var content = $("<div></div>");

    AntiMargin(content, item.BorderStyle);

    Wrap(item, "Color", function (value) {
        BrushToCss(content, value)
    });

    Wrap(item, "Width", function (value) {
        content.width(value);
    });

    Wrap(item, "Height", function (value) {
        content.height(value);
    });

    content.appendTo(container);
}
function renderScreenCaptureItem(item, container, dashboard) {
    var content = $("<div></div>");

    AntiMargin(content, item.BorderStyle);

    var video = null;
    video = $("<img style='object-fit: contain;'> </img>");

    video.get(0).addEventListener('ended', function () {
        // hide video
        video.get(0).style.display = "none";
    });

    $('source', video).last().on('error', function () {
        video.get(0).style.display = "none";
    });

    Wrap(item, "Width", function (value) {
        content.width(value);
        video.width(value);
    });

    Wrap(item, "Height", function (value) {
        content.height(value);
        video.height(value);
    });

    var isStopped = true;

    function stopVideo() {
        video.attr("src", "#");
        video.get(0).style.display = "none";
        isStopped = true;
    }

    var stopTimer = setTimeout(stopVideo, 5000);

    RegisterCustomData(dashboard, item, function (data) {
        if (isStopped) {
            video.attr("src", item.VideoPath + "?Auth=" + data);
            video.get(0).style.display = "block";
            isStopped = false;
        }
        clearTimeout(stopTimer);
        stopTimer = setTimeout(stopVideo, 5000);
    });

    video.appendTo(content);
    content.appendTo(container);
}

function renderVideoItem(item, container, dashboard) {
    var content = $("<div></div>");

    AntiMargin(content, item.BorderStyle);

    var video = null;

    function updateLoop() {
        if (item.LoopVideo)
            video.attr("loop", "loop");
        else
            video.attr("loop", null);
    }
    function buildVideoSource() {
        if (video != null) {
            video.remove();
        }

        video = $("<video autoplay muted> </video>");

        video.get(0).addEventListener('ended', function () {
            // hide video
            video.get(0).style.display = "none";
        });

        video.get(0).addEventListener("pause", function () {
            console.log("Video paused unexpectedly");
            if (item.LoopVideo) {
                buildVideoSource();
            }
        });

        $('source', video).remove();

        if (item.VideoPath != null) {
            var source = $("<source src=\"" + item.VideoPath + "\" type=\"video/webm\">");
            source.appendTo(video);
        }

        if (item.MP4VideoPath != null) {
            var source = $("<source src=\"" + item.MP4VideoPath + "\" type=\"video/mp4\">");
            source.appendTo(video);
        }

        $('source', video).last().on('error', function () {
            video.get(0).style.display = "none";
        });

        updateLoop();

        video.appendTo(content);

        content.width(item.Width);
        video.width(item.Width);

        content.height(item.Height);
        video.height(item.Height);
    }

    WrapNoInit(item, "VideoPath", function (value) {
        buildVideoSource();
    });

    WrapNoInit(item, "MP4VideoPath", function (value) {
        buildVideoSource();
    });

    WrapNoInit(item, "LoopVideo", function (value) {
        updateLoop();
    });

    buildVideoSource();

    Wrap(item, "Width", function (value) {
        content.width(value);
        video.width(value);
    });
    Wrap(item, "Height", function (value) {
        content.height(value);
        video.height(value);
    });

    video.appendTo(content);
    content.appendTo(container);
}

function renderOutlinedTextItem(item, container, dashboard) {
    //container.css("overflow", "visible");
    var content = $("<div class='noselect'></div>");
    var htmlcontent = content.get(0);

    var content2 = $("<div class='noselect'></div>");
    var htmlcontent2 = content2.get(0);

    content.addClass("flex");
    content.css("box-sizing", "border-box");

    Wrap(item, "Width", function (value) {
        content.width(value);
    });

    Wrap(item, "Height", function (value) {
        content.height(value);
    });

    item.TextPadding = DefaultValue(item.TextPadding, {});
    PaddingToCss(content, item.TextPadding);

    content2.addClass("flex");
    content2.css("box-sizing", "border-box");

    Wrap(item, "Width", function (value) {
        content2.width(value);
    });

    Wrap(item, "Height", function (value) {
        content2.height(value);
    });

    PaddingToCss(content2, item.TextPadding);

    item.TextWrapping = DefaultValue(item.TextWrapping, 1);
    Wrap(item, "TextWrapping", function (value) {
        if (value != 1) {
            content.addClass("forcewarp");
            content2.addClass("forcewarp");
        }
        else {
            content.removeClass("forcewarp");
            content2.removeClass("forcewarp");
        }
    });

    Wrap(item, "Text", function (value) {
        if (value == null) {
            htmlcontent.textContent = "";
            htmlcontent2.textContent = "";
            return;
        }
        htmlcontent2.textContent = value;
        htmlcontent.textContent = value;
    });

    setTextItemDefaults(item);

    Wrap(item, "ShadowDepth", function () {
        content.css("text-shadow", toCSSTextShadow(item.ShadowDepth, item.ShadowBlur, item.ShadowDirection, item.ShadowColor));
        content2.css("text-shadow", toCSSTextShadow(item.ShadowDepth, item.ShadowBlur, item.ShadowDirection, item.ShadowColor));
    }).addDependantProperties("ShadowBlur", "ShadowDirection", "ShadowColor");

    content.css("white-space", "pre");
    content2.css("white-space", "pre");

    content2.css("position", "absolute");
    content2.css("top", "0");
    content2.css("left", "0");

    content.css("position", "absolute");
    content.css("top", "0");
    content.css("left", "0");

    Wrap(item, "Font", function (value) {
        ApplyFont(content, value);
        ApplyFont(content2, value);
    });

    Wrap(item, "FontWeight", function (value) {
        content.get(0).style.fontWeight = toCSSFontWeight(value);
        content2.get(0).style.fontWeight = toCSSFontWeight(value);
    });

    content2.get(0).style["paintOrder"] = "stroke fill";

    Wrap(item, "FillColorEx", function (value) {
        //htmlcontent.style.color = hex2rgba(value);
        content.css("-moz-text-fill-color", hex2rgba(value));
        content.css("-webkit-text-fill-color", hex2rgba(value));
        content2.css("-moz-text-fill-color", hex2rgba(value));
        content2.css("-webkit-text-fill-color", hex2rgba(value));
    });

    Wrap(item, "StrokeColorEx", function (value) {
        htmlcontent2.style.color = hex2rgba(value);
        content2.css("-moz-text-stroke-color", hex2rgba(value));
        content2.css("-webkit-text-stroke-color", hex2rgba(value));
    });

    Wrap(item, "StrokeThickness", function (value) {
        htmlcontent2.style.color = hex2rgba(value);
        content2.css("-moz-text-stroke-width", value + "px");
        content2.css("-webkit-text-stroke-width", value + "px");
    });

    Wrap(item, "FontStyle", function (value) {
        if (value != null) {
            content.css('font-style', value.toLowerCase());
            content2.css('font-style', value.toLowerCase());
        }
    });

    Wrap(item, "FontSize", function (value) {
        content.css('font-size', value + "px");
        content2.css('font-size', value + "px");
    });

    Wrap(item, "HorizontalAlignment", function (value) {
        content.css("justify-content", toHorizontalAlignment(value)); /* align horizontal */
        content2.css("justify-content", toHorizontalAlignment(value)); /* align horizontal */
    });

    Wrap(item, "VerticalAlignment", function (value) {
        content.css("align-items", toVerticalAlignment(value)); /* align vertical */
        content2.css("align-items", toVerticalAlignment(value)); /* align vertical */
    });

    AntiMargin(content2, item.BorderStyle);
    content2.appendTo(container);

    AntiMargin(content, item.BorderStyle);
    content.appendTo(container);
}

function renderTextItem(item, container, dashboard) {
    item.UseMonospacedText = DefaultValue(item.UseMonospacedText, false);
    item.CharWidth = DefaultValue(item.CharWidth, 40.0);
    item.SpecialCharsWidth = DefaultValue(item.SpecialCharsWidth, 20.0);
    item.SpecialChars = DefaultValue(item.SpecialChars, ".,:;");
    item.TextMask = DefaultValue(item.TextMask, "");
    item.TextMaskColor = DefaultValue(item.TextMaskColor, "#FF808080");
    item.TextWrapping = DefaultValue(item.TextWrapping, 1);

    var content = $(document.createElement("div"))
        .addClass('noselect');  //$("<div class='noselect'></div>");

    if (item.UseMonospacedText) {
        content.addClass("monospaced")
    }
    var htmlcontent = content.get(0);

    content.addClass("flex");
    content.css("box-sizing", "border-box");

    Wrap(item, "Width", function (value) {
        //content.width(value);
        htmlcontent.style.width = value + "px";
    });

    Wrap(item, "Height", function (value) {
        //content.height(value);
        htmlcontent.style.height = value + "px";
    });

    item.TextPadding = DefaultValue(item.TextPadding, {});
    PaddingToCss(content, item.TextPadding);

    Wrap(item, "TextWrapping", function (value) {
        if (value != 1) content.addClass("forcewarp");
        else {
            content.removeClass("forcewarp");
        }
    });

    function monospacedWidth(character) {
        return (item.SpecialChars.indexOf(character) > -1 ? item.SpecialCharsWidth : item.CharWidth);
    }

    Wrap(item, "Text", function (value) {
        if (value == null) {
            htmlcontent.textContent = "";
            return;
        }

        if (item.UseMonospacedText === true) {
            //var res = "";
            var textMask = item.TextMask || "";
            var mask = (textMask).substring(0, Math.max((textMask).length - (item.Text || "").length, 0));
            htmlcontent.innerHTML = "";
            for (var i = 0; i < mask.length; i++) {
                //res += "<span style='display: inline-block;max-height:" + item.Height + "px;color:" + hex2rgba(item.TextMaskColor) + "; text-align: center;width:" + monospacedWidth(mask.charAt(i)) + "px'>" + mask.charAt(i) + "</span>";
                var span = document.createElement("span");
                span.style = "display: inline-block;max-height:" + item.Height + "px;color:" + hex2rgba(item.TextMaskColor) + "; text-align: center;width:" + monospacedWidth(mask.charAt(i)) + "px";
                span.innerText = mask.charAt(i);
                htmlcontent.appendChild(span);
            }

            for (var i = 0; i < value.length; i++) {
                var span = document.createElement("span");
                span.style = "display: inline-block;max-height:" + item.Height + "px;text-align: center;width:" + monospacedWidth(value.charAt(i)) + "px";
                span.innerText = value.charAt(i);
                htmlcontent.appendChild(span);
                //res += "<span style='display: inline-block;max-height:" + item.Height + "px;text-align: center;width:" + monospacedWidth(value.charAt(i)) + "px'>" + value.charAt(i) + "</span>";
            }

            //htmlcontent.innerHTML = res;
        } else {
            if (htmlcontent.lastText != value) {
                htmlcontent.lastText = value;
                htmlcontent.textContent = value;
            }
        }
    }).addDependantProperties("TextMask", "TextMaskColor", "UseMonospacedText", "SpecialChars", "SpecialCharsWidth", "CharWidth");

    setTextItemDefaults(item);

    Wrap(item, "ShadowDepth", function () {
        content.css("text-shadow", toCSSTextShadow(item.ShadowDepth, item.ShadowBlur, item.ShadowDirection, item.ShadowColor));
    }).addDependantProperties("ShadowBlur", "ShadowDirection", "ShadowColor");

    content.css("white-space", "pre");

    Wrap(item, "Font", function (value) {
        ApplyFont(content, value);
    });

    Wrap(item, "FontWeight", function (value) {
        content.get(0).style.fontWeight = toCSSFontWeight(value);
    });

    Wrap(item, "TextColor", function (value) {
        htmlcontent.style.color = hex2rgba(value);
    });

    Wrap(item, "FontStyle", function (value) {
        if (value != null) {
            content.css('font-style', value.toLowerCase());
        }
    });

    Wrap(item, "FontSize", function (value) {
        content.css('font-size', value + "px");
    });

    Wrap(item, "HorizontalAlignment", function (value) {
        content.css("justify-content", toHorizontalAlignment(value)); /* align horizontal */
        content.css("text-align", toHorizontalTextAlign(value)); /* align horizontal */
    });

    Wrap(item, "VerticalAlignment", function (value) {
        content.css("align-items", toVerticalAlignment(value)); /* align vertical */
    });
    AntiMargin(content, item.BorderStyle);
    content.appendTo(container);
}

function renderLinearGauge(item, container, dashboard) {
    var contentwrapper = $(document.createElement("div"))
        .addClass('flex');

    var content = $(document.createElement("div"))
    var htmlcontent = content.get(0);
    var htmlcontainer = container.get(0);

    Wrap(item, "GaugeAlignment", function (value) {
        contentwrapper.css("justify-content", toHorizontalAlignment(value));
    });

    Wrap(item, "PAW", function (value) {
        htmlcontent.style.width = (value == null ? 0 : value) + "px";
        if (item.GaugeAlignment == 2) {
            htmlcontent.style.backgroundPositionX = "-" + (item.Width - item.PAW) + "px";
        } else {
            if (htmlcontent.style.backgroundPositionX != "")
                htmlcontent.style.backgroundPositionX = "";
        }
    });

    Wrap(item, "BackgroundImage", function (value) {
        SetImage(container, value, dashboard);
        htmlcontainer.style.backgroundSize = item.Width + 'px ' + item.Height + 'px';
    });

    function updateGaugeImage() {
        if (!item.UseAlternateStyle) {
            SetImage(content, item.GaugeImage, dashboard);
        } else {
            SetImage(content, item.AlternateGaugeImage, dashboard);
        }

        htmlcontent.style.backgroundSize = item.Width + 'px ' + item.Height + 'px';
        //htmlcontent.style.transform = '';
        htmlcontent.style.transform = 'translateZ(0)';
    }

    function updateGaugeColor() {
        if (!item.UseAlternateStyle) {
            htmlcontent.style.backgroundColor = hex2rgba(item.GaugeColor);
        } else {
            htmlcontent.style.backgroundColor = hex2rgba(item.AlternateGaugeColor);
        }
    }

    WrapNoInit(item, "GaugeImage", updateGaugeImage);
    WrapNoInit(item, "GaugeColor", updateGaugeColor);

    WrapNoInit(item, "AlternateGaugeImage", updateGaugeImage);
    WrapNoInit(item, "AlternateGaugeColor", updateGaugeColor);

    WrapNoInit(item, "UseAlternateStyle", function () {
        updateGaugeImage();
        updateGaugeColor();
    });

    updateGaugeImage();
    updateGaugeColor();

    content.height(item.Height);
    AntiMargin(content, item.BorderStyle);
    content.appendTo(contentwrapper);
    contentwrapper.appendTo(container);
}

function renderChartItem(item, container, dashboard) {
    var dataStack = [];

    var chartCanvas = null;
    var context = null;

    function RenderChart() {
        if (!chartCanvas) {
            chartCanvas = $("<canvas></canvas>").get(0);

            chartCanvas.style.position = "absolute";
            chartCanvas.setAttribute("width", item.Width);
            chartCanvas.setAttribute("height", item.Height);

            context = chartCanvas.getContext('2d');
            $(chartCanvas).appendTo(container);
        }

        var min = item.Minimum;
        var max = item.Maximum;
        if (!item.UseMaximum) {
            max = Math.max.apply(null, dataStack);
        }
        if (!item.UseMinimum) {
            min = Math.min.apply(null, dataStack);
        }
        if (min == max && !item.UseMaximum && !item.UseMinimum) {
            var tmp = min;
            max = tmp + 1;
            min = tmp - 1;
        }

        else if (min == max && !item.UseMaximum) {
            max = min + 1;
        }

        var yMargin = 10;
        var xMargin = 10;

        context.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        context.save();

        context.lineWidth = 1;
        context.strokeStyle = 'transparent';

        //context.beginPath();
        context.rect(xMargin,
            Math.max(0, yMargin - item.LineTickness),
            chartCanvas.width - xMargin * 2,
            Math.min(chartCanvas.height, chartCanvas.height - yMargin * 2 + item.LineTickness * 2));
        context.stroke();
        context.clip();

        // invert the y scale so that that increments
        // as you move upwards
        // move context to center of canvas
        context.translate(xMargin, chartCanvas.height - yMargin);
        context.scale(1, -1);

        context.lineWidth = item.LineTickness;
        context.strokeStyle = hex2rgba(item.LineColor);

        context.beginPath();
        context.lineJoin = 'bevel';
        scaleX = (chartCanvas.width - xMargin * 2) / item.PointsCount;
        scaleY = (chartCanvas.height - yMargin * 2) / (max - min);

        context.moveTo(dataStack[0].x * scaleX, dataStack[0].y * scaleY);

        for (var n = 0; n < dataStack.length; n++) {
            var point = { x: n, y: dataStack[n] - min };

            //point.y = Math.min(Math.max(point.y, min), max);

            // draw segment
            context.lineTo(point.x * scaleX, point.y * scaleY);

            context.moveTo(point.x * scaleX, point.y * scaleY);
        }
        context.stroke();

        context.closePath();

        context.restore();
    }
    RegisterVisibilityCheck(dashboard, item, function (data) {
        if (!isVisible(container)) {
            $(chartCanvas).remove();
            chartCanvas = null;
            context = null;
            return;
        }
    });

    Wrap(item, "ChartEnabled", function (value, init) {
        dataStack = [];
        $(chartCanvas).remove();
        chartCanvas = null;
        context = null;
    });

    RegisterCustomData(dashboard, item, function (data) {
        if (isVisible(container)) {
            if (data.Points !== null) {
                for (var i = 0; i < data.Points.length; i++) {
                    dataStack.push(data.Points[i]);
                }

                while (dataStack.length > item.PointsCount) {
                    dataStack.shift();
                }
            }
            RenderChart();
        }
    });
}

function renderVerticalLinearGauge(item, container, dashboard) {
    var htmlcontainer = container.get(0);

    var gaugeCanvas = $("<canvas></canvas>").get(0);
    gaugeCanvas.style.position = "absolute";
    gaugeCanvas.setAttribute("width", item.Width);
    gaugeCanvas.setAttribute("height", item.Height);
    var gaugectx = gaugeCanvas.getContext('2d');

    $(gaugeCanvas).appendTo(container);

    var bgCanvas = $("<canvas></canvas>").get(0);
    bgCanvas.setAttribute("width", item.Width);
    bgCanvas.setAttribute("height", item.Height);
    var bgctx = bgCanvas.getContext('2d');

    var fillCanvas = $("<canvas></canvas>").get(0);
    fillCanvas.setAttribute("width", item.Width);
    fillCanvas.setAttribute("height", item.Height);
    var fillctx = fillCanvas.getContext('2d');

    var altfillCanvas = $("<canvas></canvas>").get(0);
    altfillCanvas.setAttribute("width", item.Width);
    altfillCanvas.setAttribute("height", item.Height);
    var altfillctx = altfillCanvas.getContext('2d');

    function CreateRessources() {
        bgctx.clearRect(0, 0, item.width, item.height);
        fillctx.clearRect(0, 0, item.Width, item.Height);
        fillctx.fillStyle = hex2rgba(item.GaugeColor);
        fillctx.fillRect(0, 0, item.Width, item.Height);

        altfillctx.clearRect(0, 0, item.Width, item.Height);
        altfillctx.fillStyle = hex2rgba(item.AlternateGaugeColor);
        altfillctx.fillRect(0, 0, item.Width, item.Height);
        if ((item.GaugeImage != null && item.GaugeImage !== 'None') || (item.AlternateGaugeImage != null && item.AlternateGaugeImage !== 'None')) {
            if (item.GaugeImage != null && item.GaugeImage !== 'None') {
                var bgImage = new Image();

                bgImage.onload = function () {
                    fillctx.drawImage(bgImage,
                        0, 0,
                        bgImage.width, bgImage.height,
                        0, 0,
                        item.Width, item.Height);

                    RenderGauge();
                };
                bgImage.src = GetImage(item.GaugeImage, dashboard, true);
            }
            if (item.AlternateGaugeImage != null && item.AlternateGaugeImage !== 'None') {
                var alternateImage = new Image();
                alternateImage.onload = function () {
                    altfillctx.drawImage(alternateImage,
                        0, 0,
                        alternateImage.width, alternateImage.height,
                        0, 0,
                        item.Width, item.Height);

                    RenderGauge();
                };
                alternateImage.src = GetImage(item.AlternateGaugeImage, dashboard, true);
            }
        } else {
            RenderGauge();
        }
    }

    oldPaw = 0;
    function RenderGauge() {
        var canvas = item.UseAlternateStyle ? altfillCanvas : fillCanvas
        gaugectx.clearRect(0, 0, item.Width + 10, item.Height + 10);
        if (item.GaugeAlignment === 2) {// TOP
            //gaugectx.clearRect(0, 0, item.Width + 10, item.Height + 10);
            //gaugectx.clearRect(0, 0, item.Width, oldPaw + 10);
            if (item.PAW > 0)
                gaugectx.drawImage(canvas,
                    0, 0,
                    item.Width, item.PAW,
                    0, 0,
                    item.Width, item.PAW);
        }

        if (item.GaugeAlignment === 1) {// CENTER
            //gaugectx.clearRect(0, 0, item.Width + 10, item.Height + 10);
            //gaugectx.clearRect(0, (item.Height - oldPaw - 5) / 2, item.Width, oldPaw + 10);
            if (item.PAW > 0)
                gaugectx.drawImage(canvas,
                    0, (item.Height - item.PAW) / 2,
                    item.Width, item.PAW,
                    0, (item.Height - item.PAW) / 2,
                    item.Width, item.PAW);
        }

        if (item.GaugeAlignment === 0) {// BOTTOM
            //gaugectx.clearRect(0, item.Height - op - 5, item.Width + 5, op+10);
            if (item.PAW > 0)
                gaugectx.drawImage(canvas,
                    0, item.Height - item.PAW,
                    item.Width, item.PAW,
                    0, item.Height - item.PAW,
                    item.Width, item.PAW);
        }
        oldPaw = item.PAW;
    }

    WrapNoInit(item, "GaugeAlignment", function (value) {
        RenderGauge();
    });

    WrapNoInit(item, "PAW", function (value) {
        RenderGauge();
    });

    WrapNoInit(item, "GaugeImage", function (value) {
        CreateRessources();
    });

    WrapNoInit(item, "GaugeColor", function (value) {
        CreateRessources();
    });

    WrapNoInit(item, "AlternateGaugeImage", function (value) {
        CreateRessources();
    });
    WrapNoInit(item, "AlternateGaugeColor", function (value) {
        CreateRessources();
    });

    WrapNoInit(item, "UseAlternateStyle", function (value) {
        RenderGauge();
    });

    Wrap(item, "BackgroundImage", function (value) {
        SetImage(container, value, dashboard);
        htmlcontainer.style.backgroundSize = item.Width + 'px ' + item.Height + 'px';
    });

    WrapNoInit(item, "GaugeImage", function (value) {
        CreateRessources();
    });

    CreateRessources();
}
