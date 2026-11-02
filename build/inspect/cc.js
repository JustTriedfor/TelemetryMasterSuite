function GetCurrentTemplate() {
    if (HashHelper.HashParameterExists("nocontrols")) {
        $("#controls").removeClass("forcevisible").hide();
        $("#controls2").removeClass("forcevisible").hide();
    }

    var hash = window.location.hash.substring(1);
    var d = hash.split("|");
    return d[0];
}

window.SimHubDashMetadataCallBacks = [];
window.OnMainDashMetadata = function (callback) {
    if (document.DashMetadata) {
        callback(document.DashMetadata);
    } else {
        window.SimHubDashMetadataCallBacks.push(callback);
    }
}
window.SetMetadataReady = function () {
    for (var i in window.SimHubDashMetadataCallBacks) {
        try {
            window.SimHubDashMetadataCallBacks[i](document.DashMetadata);
        } catch (e) {
        }
    }
    window.SimHubDashMetadataCallBacks = [];

    try {
        var evt = new CustomEvent("onmainsimhubdashmetadata", {
            detail: document.DashMetadata
        });

        window.dispatchEvent(evt);
    } catch (e) {
    }
}

document.getElementById("loadingLabel").innerHTML = "Loading " + decodeURIComponent(GetCurrentTemplate()).replace(/\+/g, " ");

if (window.location.hash) {
    var hash = window.location.hash.substring(1);

    if (!HashHelper.HashParameterExists("overlay")) {
        $("body").css("background", "black");
    } else {
        $("body").addClass("overlay-mode");
    }

    if (HashHelper.HashParameterExists("nocontrols")) {
        $("#controls").removeClass("forcevisible").hide();
        $("#controls2").remove();
    } else {
        $("#controls2").css("opacity", 1);
    }
} else {
    $("#controls2").css("opacity", 1);
}

function SetDivSizes() {
    var w = document.documentElement.clientWidth;
    var h = document.documentElement.clientHeight;

    if (window.frameElement) {
        var h = $(window.frameElement).height();
        var w = $(window.frameElement).width();
    } else {
    }

    $(".sizeme").width(w + "px");
    $(".sizeme").height(h + "px");

    $(".rotateme.forcerotate").height(w + "px");
    $(".rotateme.forcerotate").width(h + "px");
}

SetDivSizes();
$(window).resize(SetDivSizes);

window.addEventListener("message", function (event) {
    if (event.data == "divresized") {
        SetDivSizes();
        var div = $("#fill");
        fillDiv(div, true);
    }
});

$(function () {
    // Enable wake lock.
    // (must be wrapped in a user input event handler e.g. a mouse or touch handler)
    // document.addEventListener('click', enableNoSleep, false);

    var closeTimeeout = 0;
    var oppenedFromWipe = false;

    function openControls() {
        $("#controls2").animate({ top: 0, opacity: 1 }, 250);
        //console.log("mouse over");
        clearTimeout(closeTimeeout);
    }

    function closeControls(delay) {
        clearTimeout(closeTimeeout);
        closeTimeeout = setTimeout(function () {
            $("#controls2").animate({ top: -48, opacity: 0.00 }, 250, 'linear');
        }, delay);
        $(".mobilehelp").slideUp();
    }

    function detectTouch() {
        if (typeof window !== 'undefined') {
            return Boolean(
                'ontouchstart' in window ||
                window.navigator.maxTouchPoints > 0 ||
                window.navigator.msMaxTouchPoints > 0 ||
                window.DocumentTouch && document instanceof DocumentTouch
            );
        }
    }
    if (!detectTouch()) {
        $("#controls2").on("mouseenter", function () {
            openControls();
            oppenedFromWipe = false;
        });

        $("#controls2").on("mouseleave", function () {
            closeControls(500);
        });

        $("body").addClass("notouch");
    } else {
        $("body").addClass("touch");
    }

    function resizeControls() {
        var isFullScreen = document.fullScreen ||
            document.mozFullScreen ||
            document.webkitIsFullScreen;
        if (isFullScreen) {
            $("#controls2").css("transform", "scale(" + ($(".maincontainer").width() / 720) + ")");
        } else {
            $("#controls2").css("transform", "scale(1)");
        }
    }

    if (!detectTouch() || navigator.userAgent == "SimHub.Mobile") {
        openControls();
        closeControls(3000);
    } else {
        $(".mobilehelp").show();
        if (!iOS) {
            setInterval(function () {
                resizeControls();
            }, 100);
        }
    }

    if (navigator.userAgent == "SimHub.Mobile") {
        $("#fsbutton").hide();
    }

    function toggleControls() {
        if ($("#controls").hasClass("forcevisible")) {
            $("#controls").addClass("forcehidden");
            $("#controls").removeClass("forcevisible");
        } else {
            $("#controls").removeClass("forcehidden");
            $("#controls").addClass("forcevisible");
        }
    }
    $("body").click(function () {
        window.top.postMessage("click", document.location.origin);
    })

    $(document).keyup(function (e) {
        if (e.key === "Escape") { // escape key maps to keycode `27`
            window.top.postMessage("escapepressed", document.location.origin);
        }
    });

    $("body").touchwipe({
        wipeLeft: function () {
            window.simhub.client.actionTriggered(7, "NextScreen");
            enableNoSleep();
        },
        wipeRight: function () {
            window.simhub.client.actionTriggered(6, "PreviousScreen");
            enableNoSleep();
        },
        wipeUp: function () {
            window.top.postMessage("wipeup", document.location.origin);
            oppenedFromWipe = true;
            openControls();
            closeControls(3000);
            enableNoSleep();
        },
        wipeDown: function () {
            window.top.postMessage("wipedown", document.location.origin);
            closeControls(0);
            enableNoSleep();
        },
        min_move_x: 100,
        min_move_y: 75,
        preventDefaultEvents: false
    });

    function checkKey(e) {
        if (e.keyCode == 37) {
            window.simhub.client.actionTriggered(6, "PreviousScreen");
        } else if (e.keyCode == 39) {
            window.simhub.client.actionTriggered(7, "NextScreen");
        } else if (e.keyCode == 8) {
            location = "/";
        }
        //alert(e.keyCode);
        e.preventDefaultEvents = true;
    }

    window.addEventListener('keydown', checkKey, false);

    if (typeof reload2 != 'undefined')
        reload2.addEventListener("click", function () {
            location.reload();
        });

    if (typeof back2 != 'undefined')
        back2.addEventListener("click", function () {
            if (typeof SimHubMobile != 'undefined') {
                SimHubMobile.showToast("Back !");
            } else {
                location = "/";
            }
        });

    if (typeof prevscreen != 'undefined')
        prevscreen.addEventListener("click", function () {
            window.simhub.client.actionTriggered(6, "PreviousScreen");
            if (oppenedFromWipe) {
                enableNoSleep();
                closeControls(2000);
            }
        });

    if (typeof nextscreen != 'undefined')
        nextscreen.addEventListener("click", function () {
            window.simhub.client.actionTriggered(7, "NextScreen");
            if (oppenedFromWipe) {
                enableNoSleep();
                closeControls(2000);
            }
        });

    if (typeof goFS2 != 'undefined')
        //var goFS = document.getElementById("goFS");
        goFS2.addEventListener("click", function () {
            enableNoSleep();
            if (iOS) {
                closeControls(0);
                //return;
            }

            if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
                elem = $(".wrapper").get(0);
                if (elem.requestFullscreen) {
                    elem.requestFullscreen();
                    resizeControls();
                } else if (elem.mozRequestFullScreen) {
                    elem.mozRequestFullScreen();
                    resizeControls();
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                    resizeControls();
                } else {
                    return;
                }
                try {
                    var mode = screen.orientation.type;

                    if (simhub.CurrentDash != null && simhub.CurrentDash.BaseWidth > simhub.CurrentDash.BaseHeight) {
                        if (mode.indexOf("landscape") == -1) {
                            mode = "landscape-primary";
                        }
                    } else if (simhub.CurrentDash != null && simhub.CurrentDash.BaseWidth < simhub.CurrentDash.BaseHeight) {
                        if (mode.indexOf("portrait") == -1) {
                            mode = "portrait-primary";
                        }
                    }
                    screen.orientation.lock(mode);
                } catch (ex) {
                }

                closeControls(500);
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
                try {
                    screen.orientation.unlock();
                } catch (ex) {
                    closeControls(500);
                }

                $("#controls2").css("transform", "scale(1)");
            }
        }, false);

    var socket = null;
    window.simhub = {};

    var redlineblock = $(".redline");
    var redlinehidden = false;
    window.simhub.blinker = setInterval(function () {
        if (window.simhub.redline == true) {
            redlinehidden = false;
            requestAnimationFrame(function () { redlineblock.toggle(); });
        } else {
            if (!redlinehidden) {
                requestAnimationFrame(function () { redlineblock.hide(); });
            }
            redlinehidden = true;
        }
    }, 150);

    function reset() {
        $(".maincontainer").html("");
        window.simhub = {};
        window.simhub.client = {};
        window.simhub.server = {};
        window.SimHubWrapItems = {};
        window.SimHubDataCallBacks = [];

        window.SimHubVisibilityCheckCallBacks = [];
        window.SimHubRegisteredComponents = {};
        window.SimHubDelayedMessages = null;
        window.SimHubPostUpdateCallbacks = null;
        window.SimHubDashCache = [];
        window.SimHubDashCacheCallbacks = [];

        //window.simhub.blinker = null;
        window.simhub.redline = false;
        if (window.ImageStyleMap != null) {
            for (var s in window.ImageStyleMap) {
                window.ImageStyleMap[s].parentNode.removeChild(window.ImageStyleMap[s]);
            }
        }

        window.ImageStyleMap = {};
        window.simhub.server.registerComponents = function (dashpath) { socket.send("registerComponents|" + dashpath) }
        window.simhub.server.notifyMainTemplateLoaded = function () { socket.send("mainTemplateLoaded|") }
        window.simhub.server.notifyMainTemplateLoading = function () { socket.send("mainTemplateLoading|") }
        window.simhub.server.componentDatas = function (data) { socket.send("componentDatas|" + JSON.stringify(data)); }

        window.simhub.server.GetRemoteConnectionId = function () {
            if (HashHelper.HashParameterExists("remotecontrolid")) {
                var remotecontrolid = decodeURIComponent(HashHelper.HashParameterValue("remotecontrolid"));
                return "?remoteConnectionID=" + remotecontrolid
            }

            if (HashHelper.HashParameterExists("contextid")) {
                var remotecontrolid = decodeURIComponent(HashHelper.HashParameterValue("contextid"));
                return "?contextID=" + remotecontrolid
            }

            return "";
        }

        window.simhub.client.pluginMessage = function (data) {
            $("#message").css("transform", "scale(" + Math.min(1, $(".maincontainer").width() / 720) + ")");

            if (!HashHelper.HashParameterExists("nomessages")  && simhub.EnableOnDashboardMessaging == true) {
                if (data === null) {
                    $("#message").animate({ opacity: 0 }, 200, 'linear');
                } else {
                    if (data.MinValue != null && data.MaxValue != null && data.CurrentValue != null) {
                        var percent = data.CurrentValue / (data.MaxValue - data.MinValue) * 100;
                        $("#pbvalue").width(percent + "%");
                        $("#messagepb").show();
                    } else {
                        $("#messagepb").hide();
                    }

                    $("#messagetitle").text(data.MessageTitle);
                    $("#messagevalue").text(data.Value);
                    $("#message").animate({ opacity: 1 }, 200, 'linear');
                }
            }
        }

        window.simhub.client.actionTriggered = function (actionId, actionName) {
            console.log("Action received : id " + actionId + " name " + actionName);
            socket.send("actionTriggered|" + actionId);
        }

        window.simhub.client.overlayActionTriggered = function (actionId, actionName) {
            document.getElementById("overlayiframe").contentWindow.simhub.client.actionTriggered(actionId, actionName);
        }

        contrastSetting = 1;
        brightnessSetting = 1;

        window.simhub.client.setBrightness = function (brighness) {
            brightnessSetting = brighness;
            document.getElementsByTagName("body")[0].style.filter = "contrast(" + contrastSetting + ") brightness(" + brightnessSetting + ")";
        }

        window.simhub.client.setContrast = function (contrast) {
            contrastSetting = contrast;
            document.getElementsByTagName("body")[0].style.filter = "contrast(" + contrastSetting + ") brightness(" + brightnessSetting + ")";
        }

        window.simhub.client.AddTouchTrace = function (x, y, color) {
            var div = $("<div></div>");
            div.css("position", "absolute");
            div.css("left", x + "px");
            div.css("top", y + "px");
            div.css("width", "10px");
            div.css("height", "10px");
            div.css("background", color || "red");
            div.addClass("nopointerevents")
            div.appendTo($("body"));
        }

        window.simhub.client.SetTouchTraceStatus = function (id, active, color) {
            var statusId = "simhub-touch-status-" + id;
            var div = document.getElementById(statusId);

            if (!div) {
                div = document.createElement("div");
                div.id = statusId;
                div.className = "nopointerevents";
                div.style.position = "fixed";
                div.style.top = "8px";
                div.style.right = (8 + id * 28) + "px";
                div.style.width = "20px";
                div.style.height = "20px";
                div.style.lineHeight = "20px";
                div.style.textAlign = "center";
                div.style.color = "white";
                div.style.font = "bold 12px sans-serif";
                div.style.border = "2px solid " + color;
                div.style.boxSizing = "border-box";
                div.style.zIndex = "2147483647";
                document.body.appendChild(div);
            }

            div.textContent = id + 1;
            div.style.backgroundColor = active ? "#00b33c" : "#d00000";
        }
    }

    //reset();

    var reconnectMessage = $(".reconnectMessage");
    var ti = 0;
    function ReConnect() {
        clearTimeout(ti);
        window.simhub.redline = false;
        reconnectMessage.show();
        ti = setTimeout(function () {
            var aborted = false;
            var req = $.ajax({
                url: "/echo/",
                dataType: 'json',
                success: function (data) {
                    if (!aborted) {
                        Connect();
                    }
                },
                timeout: 500
            }).fail(function () {
                aborted = true;
                req.abort();
                ReConnect();
            });
        }, 2000);
    }

    $("<li>Waiting for connection</li>").appendTo($(".progresslist"));
    var ti;
    function Connect() {
        var connected = false;
        reset();

        var protocol = (window.location.protocol === "https:") ? "wss://" : "ws://";
        var port = window.location.port ? ":" + window.location.port : ""; // optional if port is standard (80/443)

        socket = new WebSocket(
            protocol + window.location.hostname + port +
            "/ws" + window.simhub.server.GetRemoteConnectionId()
        );

        socket.onopen = function () {
            $("<li>Connected</li>").appendTo($(".progresslist"));
            socket.send("echo|");
        };

        socket.onclose = function (evt) {
            console.log('WebSocket Closed ');
            connected = false;
            ReConnect();
        };

        socket.onerror = function (error) {
            console.log('WebSocket Error ' + error);
            ReConnect();
        };

        var componentsUpdatedType = "CU";
        var inputPressedType = "inputPressed";
        var pluginMessageType = "pluginMessage";
        var oldFlashColor = "";

        window.ReceivedPackets = 0;

        function Ack(pid) {
            socket.send("pid|" + pid);
        }

        function ShowLayer(layerId) {
            if (layerId !== null) {
                var newForegroundLayer = $("#" + layerId);
                newForegroundLayer
                    .show()
                    .addClass("active")
                    .removeClass("waitingforrender");
            }
        }

        var isFirstMessage = true;

        function componentsUpdated(parentTask, data) {
            if (isFirstMessage) {
                $(".progress").hide();
                $("#progressOverlay").hide();
                $(".maincontainer").show();

                initialize();
                //console.log("Time after first update : " + performance.now() / 1000 + "s");
                isFirstMessage = false;
            }

            if (data.RL != null) {
                window.simhub.redline = data.RL;
            }

            var updateTask = new FakeTask(parentTask);

            var repeatTask = new FakeTask(updateTask)
                .onRun(function (childtask) {
                    if (data.REP != null) {
                        setProp(childtask, data.REP, "Repetitions");
                    }
                });

            var widgetTask = new FakeTask(updateTask)
                .onRun(function (childtask) {
                    if (data.WIDGETCHANGE != null) {
                        setProp(childtask, data.WIDGETCHANGE, "WidgetChange");
                    }
                });

            var finishTask = new FakeTask(updateTask)
                .onRun(function (childtask) {
                    if (data.FC != null && data.FC != oldFlashColor) {
                        oldFlashColor = data.FC;

                        $(".redline").css("background", hex2rgba(oldFlashColor));
                    }

                    for (componentId in data.D) {
                        var cb = window.SimHubDataCallBacks[componentId]
                        if (cb != null) {
                            cb(data.D[componentId]);
                        }
                    }

                    for (componentId in window.SimHubVisibilityCheckCallBacks) {
                        var cb = window.SimHubVisibilityCheckCallBacks[componentId]
                        if (cb != null) { cb(); }
                    }

                    if (data.T != null) {
                        setProp(parentTask, data.T, "Text");
                        //console.log("set text finished")
                    }
                    if (data.TC != null) {
                        setProp(parentTask, data.TC, "TextColor");
                    }

                    if (data.BC != null) {
                        setProp(parentTask, data.BC, "BackgroundColor");
                    }

                    if (data.S != null) {
                        changeVis(parentTask, data.S, true);
                    }

                    if (data.H != null) {
                        changeVis(parentTask, data.H, false);
                    }

                    updateProperties(parentTask, data.C);

                    if (window.SimHubPostUpdateCallbacks != null) {
                        var callbacksCollection = window.SimHubPostUpdateCallbacks;
                        window.SimHubPostUpdateCallbacks = null;

                        for (var key in callbacksCollection) {
                            callbacksCollection[key]();
                        }
                    }

                    if (data.A > 0) {
                        socket.send("acq|1");
                    }

                    if (window.SimHubDelayedMessages != null) {
                        var m = window.SimHubDelayedMessages;
                        window.SimHubDelayedMessages = null;
                        window.simhub.server.componentDatas(m);
                    }
                    if (isFirstMessage) {
                        //console.log("Time after first update processed: " + performance.now() / 1000 + "s");
                    }
                })

            repeatTask.then(widgetTask);
            widgetTask.then(finishTask);
            finishTask.onComplete(function () { updateTask.complete(); })

            repeatTask.start();
        }

        function RenderFrame(updateTask, data, pid) {
            var updateTask = new FakeTask(updateTask)
                .setName("RenderFrame")
                .onRun(function (task) {
                    Ack(pid);

                    if (data.a === componentsUpdatedType) {
                        var componentupdateTask = new FakeTask(task)
                            .onRun(function (task) {
                                //console.log("Starting frame " + pid);
                                componentsUpdated(task, data.d);
                            })
                            .onComplete(function () {
                                if (data.d.ActiveScreens !== undefined) {
                                    for (var dashboardId in data.d.ActiveScreens) {
                                        $("#d" + dashboardId + ">.screen").hide().removeClass("active");
                                        ShowLayer(data.d.ActiveScreens[dashboardId].ScreenId);
                                        ShowLayer(data.d.ActiveScreens[dashboardId].ForegroundLayerId);
                                        ShowLayer(data.d.ActiveScreens[dashboardId].BackgroundLayerId);
                                    }
                                }
                                if (data.d.ActiveOverlays !== undefined) {
                                    for (var overlayDashboardId in data.d.ActiveOverlays) {
                                        $("#d" + overlayDashboardId + ">.overlaylayer").hide().removeClass("active");
                                        for (var overlayId in data.d.ActiveOverlays[overlayDashboardId]) {
                                            ShowLayer(data.d.ActiveOverlays[overlayDashboardId][overlayId]);
                                        }
                                    }
                                }
                                //console.log("Frame " + pid + " finished.");
                            }).start();
                    }
                    else if (data.a === pluginMessageType) {
                        window.simhub.client.pluginMessage(data.d);
                    } else if (data.a === inputPressedType) {
                        if (!HashHelper.HashParameterExists("usbd480")) {
                            window.simhub.client.actionTriggered(data.d.InputId, data.d.InputName);
                        }
                    }
                })
                .start();
        }

        socket.onmessage = function (messageEvent) {
            var pid = messageEvent.data.substr(0, messageEvent.data.indexOf("|"));
            var messageEventData = messageEvent.data.substr(messageEvent.data.indexOf("|") + 1)

            if (ti != null) {
                clearTimeout(ti);
            }

            ti = null;
            if (!connected) {
                reconnectMessage.hide();
                Connected();
            }
            connected = true;

            if (messageEventData === "echo") {
                Ack(pid);
                return;
            }

            var data = JSON.parse(messageEventData);

            var updateTask = new FakeTask()
                .setName("UpdateTask")
                .onRun(function (task) {
                    //console.log("rendering " + pid);
                    RenderFrame(updateTask, data, pid)
                }).onComplete(function () {
                    //  console.log("rendered " + pid);
                });

            renderQueue.enqueueRenderTask(updateTask);
        };
    }

    Connect();
});

function SendComponentMessage(dashboard, component, message, allowAggregate) {
    if (allowAggregate) {
        if (window.SimHubDelayedMessages == null) {
            window.SimHubDelayedMessages = {};
        }
        window.SimHubDelayedMessages[component.uid] = message;
    } else {
        var m = {};
        m[component.uid] = message;
        window.simhub.server.componentDatas(m);
    }
}

function RegisterPostModelUpdateCallback(component, callback) {
    if (window.SimHubPostUpdateCallbacks == null) {
        window.SimHubPostUpdateCallbacks = {};
    }
    window.SimHubPostUpdateCallbacks[component.uid] = callback;
}

function Connected() {
    $("body").css("overflow", "hidden");
    var renderQueue = new RenderQueue();
    var hash = window.location.hash.substring(1);

    if (HashHelper.HashParameterExists("widget")) {
        var widget = decodeURIComponent(HashHelper.HashParameterValue("widget"));
        LoadMainTemplate(decodeURIComponent(GetCurrentTemplate()), widget);
    } else {
        LoadMainTemplate(decodeURIComponent(GetCurrentTemplate()), null);
    }
}

function GetDashJson(isPrimary, path, downloadpath, successcallback, failcallback) {
    var cached = window.SimHubDashCache[path];

    if (cached != null) {
        if (cached !== "") {
            //console.log('Loaded from cache : ' + path);
            // Clone
            successcallback($.extend(true, {}, cached));
        } else {
            //console.log("Loaded from cache : missing " + path);
            failcallback();
        }

        return;
    } else {
        var firstCB = false;
        if (window.SimHubDashCacheCallbacks[path] == null) {
            window.SimHubDashCacheCallbacks[path] = [];
            firstCB = true;
        }

        window.SimHubDashCacheCallbacks[path].push(
            {
                success: function (data) {
                    successcallback(data);
                },
                fail: function (data) {
                    failcallback();
                }
            });

        if (!firstCB) {
            console.log('Added to callback queue : ' + path);
            return;
        }
    }

    console.log('Requesting : ' + path);

    $.getJSON(downloadpath, function (data) {
        data["Path"] = path;

        data.Images.forEach(function (image) {
            image.Uid = Math.random().toString(36).substr(2, 9);
            createImageStyle(image.Uid, image.Data, image.WebPath);
        });

        if (!isPrimary) {
            window.SimHubDashCache[path] = data;
        }

        window.SimHubDashCacheCallbacks[path].forEach(function (cb) { cb.success(!isPrimary ? $.extend(true, {}, data) : data); });
    }).fail(function () {
        window.SimHubDashCache[path] = "";

        if (isPrimary == true) {
            window.alert("This dash does not exists anymore, redirecting you to the list.");
            document.location = "/";
        } else {
            window.SimHubDashCacheCallbacks[path].forEach(function (cb) { cb.fail(); });
        }
    });
}

function LoadMainTemplate(template, widget) {
    var path = null;
    document.mainTask = new FakeTask()
        .setName("LoadMainTemplate")
        .onComplete(function (task) {
            console.log("Load main template completed");
            window.simhub.server.notifyMainTemplateLoaded();
            $("<li>Waiting for data</li>").appendTo($(".progresslist"));
            window.SimHubDashCacheCallbacks = [];
        }).onRun(function (task) {
            window.simhub.server.notifyMainTemplateLoading();
            path = LoadTemplate(task, template, widget, null, false, null, "", true, null);
            window.simhub.server.registerComponents(path);
        })

    renderQueue.enqueueRenderTask(document.mainTask);
}

function LoadTemplate(parentTask, template, widget, container, isWidget, widgetItem, templateInstanceUid, isPrimary, initialScreenIndex) {
    //console.log("Load template started " + template);

    var loadTemplateTask = new FakeTask(parentTask)
        .setName("load template")

    if (widget == null) {
        widget = template + ".djson";
    }

    if (isWidget != true) {
        $(".maincontainer").hide();
        $(".progresslist").html("");
        $("<li>Loading template " + decodeURI(template) + "</li>").appendTo($(".progresslist"));
        $("#loadingLabel").html("Loading " + decodeURI(template).replace(/\+/g, " "));
    }

    var downloadpath = "/Dashtemplates/Definition/?dash={0}&widget={1}".format(encodeURIComponent(template), encodeURIComponent(widget));
    var path = "/Dashtemplates/{0}/{1}".format(template, widget);

    GetDashJson(isPrimary, path, downloadpath,
        // Success
        function (data) {
            data['templateName'] = template;
            data['widgetName'] = widget;
            data['isWidget'] = isWidget;

            try {
                if (isPrimary) {
                    var displayname = template;
                    if (data.Metadata.Title != null) {
                        displayname = data.Metadata.Title;
                    }
                    document.DashMetadata = data.Metadata;
                    window.SetMetadataReady();

                    window.top.document.title = "SimHub - " + displayname;
                }
            } catch (error) { }

            RenderTemplate(loadTemplateTask, data, container, isWidget, widgetItem, templateInstanceUid, initialScreenIndex);
            loadTemplateTask.complete();
        },
        // Fail
        function (data) {
            loadTemplateTask.complete();
        }
    );

    return path;
}

function RenderTemplate(parentTask, dashboard, container, isWidget, widgetItem, templateInstanceUid, initialScreenIndex) {
    if (container == null) {
        container = $(".maincontainer");
    }
    if (templateInstanceUid === "") {
        container.html("");
    }

    container.attr("data-path", dashboard.File);

    var dash = $(document.createElement("div"))
        .addClass("dash")
        .attr("id", "d" + templateInstanceUid)
        .css("overflow", "hidden");

    dash.width(dashboard.BaseWidth);
    dash.height(dashboard.BaseHeight);

    container.width(dashboard.BaseWidth);
    container.height(dashboard.BaseHeight);

    dash.appendTo(container);

    screenIdx = 0;

    // Fallback initialScreenIndex to screen 0 if out of range
    if (initialScreenIndex != null) {
        availableScreensCount = 0;
        dashboard.Screens.forEach(function (element) {
            if (!element.IsForegroundLayer && !element.IsBackgroundLayer && !element.IsOverlayLayer) {
                availableScreensCount++;
            }
        });
        initialScreenIndex = Math.max(0, Math.min(initialScreenIndex, availableScreensCount - 1));
    }

    dashboard.Screens.forEach(function (element) {
        element.ScreenIdx = screenIdx;
        screenIdx++;
    });

    dashboard.Screens.forEach(function (element) {
        if (element.IsBackgroundLayer) {
            var screen = RenderScreen(dash, dashboard, element, templateInstanceUid, parentTask);
            screen.addClass("backgroundlayer");
        }
    });

    dashboard.Screens.forEach(function (element) {
        if (!element.IsForegroundLayer && !element.IsBackgroundLayer && !element.IsOverlayLayer) {
            if (initialScreenIndex == null || element.ScreenIdx == initialScreenIndex) {
                var screen = RenderScreen(dash, dashboard, element, templateInstanceUid, parentTask);
            }
        }
    });

    dashboard.Screens.forEach(function (element) {
        if (element.IsForegroundLayer) {
            var screen = RenderScreen(dash, dashboard, element, templateInstanceUid, parentTask);
            screen.addClass("foregroundlayer");
        }
    });

    dashboard.Screens.forEach(function (element) {
        if (element.IsOverlayLayer) {
            var screen = RenderScreen(dash, dashboard, element, templateInstanceUid, parentTask);
            screen.removeClass("screen");
            screen.addClass("overlaylayer");
        }
    });

    if (!isWidget) {
        simhub.CurrentDash = dashboard;
        simhub.EnableOnDashboardMessaging = dashboard.EnableOnDashboardMessaging;
    }
}
