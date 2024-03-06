define(["qlik", "jquery", "text!./style.css"], function (qlik, $, cssContent) {
    'use strict';

    $("<style>").html(cssContent).appendTo("head");

    function createRows(rows, dimensionInfo) {
        var html = "";
        rows.forEach(function (row) {
            html += '<tr>';
            row.forEach(function (cell, key) {
                if (cell.qIsOtherCell) {
                    cell.qText = dimensionInfo[key].othersLabel;
                }
                html += "<td ";
                if (!isNaN(cell.qNum)) {
                    html += "class='numeric'";
                }
                html += '>' + cell.qText + '</td>';
            });
            html += '</tr>';
        });
        return html;
    }

    function exportToTxt(filename, rows, customDelimiter) {
        var processRow = function (row) {
            var finalVal = '';
            for (var j = 0; j < row.length; j++) {
                var innerValue = row[j] === null ? '' : row[j].toString();
                if (row[j] instanceof Date) {
                    innerValue = row[j].toLocaleString();
                }
                var result = innerValue.replace(/"/g, '""');
                if (result.search(/("|,|\n)/g) >= 0) {
                    result = '"' + result + '"';
                }
                if (j > 0) {
                    finalVal += customDelimiter;
                }
                finalVal += result;
            }
            return finalVal + '\n';
        };

        var txtFile = '';
        for (var i = 0; i < rows.length; i++) {
            txtFile += processRow(rows[i]);
        }

        var blob = new Blob([txtFile], { type: 'text/plain;charset=utf-8;' });
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
        } else {
            var link = document.createElement('a');
            if (link.download !== undefined) {
                var url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }

    function exportToCsv(filename, rows, customDelimiter) {
        var processRow = function (row) {
            var finalVal = '';
            for (var j = 0; j < row.length; j++) {
                var innerValue = row[j] === null ? '' : row[j].toString();
                if (row[j] instanceof Date) {
                    innerValue = row[j].toLocaleString();
                }
                var result = innerValue.replace(/"/g, '""');
                if (result.search(/("|,|\n)/g) >= 0) {
                    result = '"' + result + '"';
                }
                if (j > 0) {
                    finalVal += customDelimiter;//';';
                }
                finalVal += result;
            }
            return finalVal + '\n';
        };

        var csvFile = '';
        for (var i = 0; i < rows.length; i++) {
            csvFile += processRow(rows[i]);
        }

        var blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
        } else {
            var link = document.createElement('a');
            if (link.download !== undefined) {
                var url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }

    return {
        initialProperties: {
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [],
                qInitialDataFetch: [{
                    qWidth: 10,
                    qHeight: 200
                }]
            }
        },
        definition: {
            type: "items",
            component: "accordion",
            items: {
                dimensions: {
                    uses: "dimensions",
                    min: 1
                },
                measures: {
                    uses: "measures",
                    min: 0
                },
                sorting: {
                    uses: "sorting"
                },
                newSection: {
                    label: "Output file",
                    type: "items",
                    items: {
                        delimitercombo: { 
                            type: "string",
                            component: "dropdown",
                            label: "Delimiter",
                            ref: "props.delimiter",
                            options: [
                                {
                                    value: ",",
                                    label: ","
                                },
                                {
                                    value: "|",
                                    label: "|"
                                },
                                {
                                    value: ";",
                                    label: ";"
                                }
                            ],
                            defaultValue: "," 
                        },
                        fileFormat: {
                            ref: "props.fileFormat",
                            label: "File Format",
                            type: "string",
                            component: "dropdown",
                            options: [
                                {
                                    value: "csv",
                                    label: "CSV"
                                },
                                {
                                    value: "txt",
                                    label: "TXT"
                                }
                            ],
                            defaultValue: "csv"
                        },
                        filename: {
                            ref: "props.filename",
                            label: "File Name",
                            type: "string",
                            defaultValue: "data",
                            expression: "optional"
                        },
                        includeHeaders: {
                            ref: "props.includeHeaders",
                            label: "Include Headers",
                            type: "boolean",
                            defaultValue: false
                        }
                    }
                },
                settings: {
                    uses: "settings"
                }
            }
        },
        snapshot: {
            canTakeSnapshot: true
        },
        paint: function ($element, layout) {
            
            var customDelimiter = layout.props.delimiter;
            var customFilename = layout.props.filename + "." + layout.props.fileFormat;
            var includeHeaders = layout.props.includeHeaders;
            var ClickExport = 0;

            var html = "<div class='container container-btn'><div class='row justify-content-end'><div class='col-auto'><button id='exportToCsv' class='btn btn-primary mt-3'>Exportar a " + layout.props.fileFormat.toUpperCase() + "</button></div></div><div class='row justify-content-end'><div class='col-auto'><div id='estatus' class='message-disabled'></div></div></div></div><div class='progress-bt mt-3'><div id='progressBar' class='progress-bar progress-bar-striped progress-bar-animated' role='progressbar' aria-valuemin='0' aria-valuemax='100'></div></div><div><table class='table table-striped table-bordered'><thead><tr>", self = this,
                morebutton = false,
                hypercube = layout.qHyperCube,
                rowcount = hypercube.qDataPages[0].qMatrix.length,
                colcount = hypercube.qDimensionInfo.length + hypercube.qMeasureInfo.length;
            //render titles
            hypercube.qDimensionInfo.forEach(function (cell) {
                html += '<th>' + cell.qFallbackTitle + '</th>';
            });
            hypercube.qMeasureInfo.forEach(function (cell) {
                html += '<th>' + cell.qFallbackTitle + '</th>';
            });
            html += "</tr></thead><tbody>";
            //render data
            html += createRows(hypercube.qDataPages[0].qMatrix, hypercube.qDimensionInfo);
            html += "</tbody></table></div>";
            //add 'more...' button
            if (hypercube.qSize.qcy > rowcount) {
                html += "<button class='more'>More...</button>";
                morebutton = true;
            }
//            console.log("qzise: " + hypercube.qSize.qcy);
            $element.html(html);
            if (hypercube.qSize.qcy > 200000){
                $element.find('#exportToCsv').prop('disabled', true);
                $element.find('#estatus').text('La cantidad de registros supera los 200,000. Exportación deshabilitada.');
            }
            var allRows = [];
            if (morebutton) {
                $element.find(".more").on("click", function () {
                    var requestPage = [{
                        qTop: rowcount,
                        qLeft: 0,
                        qWidth: colcount,
                        qHeight: Math.min(1000, hypercube.qSize.qcy - rowcount)
                    }];
                    self.backendApi.getData(requestPage).then(function (dataPages) {
                        rowcount += dataPages[0].qMatrix.length;
                        var dataMatrix = dataPages[0].qMatrix;
                        var pageRows = dataMatrix.map(function (row) {
                            return row.map(function (cell) {
                                return cell.qText;
                            });
                        });
                        allRows = allRows.concat(pageRows);
                        if (rowcount >= hypercube.qSize.qcy || rowcount >= 200000 ) {
                            $element.find(".more").hide();
                        }
                        var html = createRows(dataPages[0].qMatrix, hypercube.qDimensionInfo);
                        $element.find("tbody").append(html);
                    });
                });
            }

             $element.find("#exportToCsv").on("click", function () {
                var ciclo = 0;
                $element.find("#progressBar").css("width", "0%");
                var exportAllData = function (pages) {
                    pages.forEach(function (page) {
                        var dataMatrix = page.qMatrix;
                        var pageRows = dataMatrix.map(function (row) {
                            return row.map(function (cell) {
                                return cell.qText;
                            });
                        });
                        allRows = allRows.concat(pageRows);
                        if ( ciclo > 0 ){
                            rowcount += page.qMatrix.length;
                        }
                        var progress = (rowcount / hypercube.qSize.qcy) * 100;

                        $element.find("#progressBar").css("width", progress + "%").text(progress.toFixed(2) + "%");
                        $element.find('#exportToCsv').prop('disabled', true);
                        $element.find("#exportToCsv").text("Exportando...");
                        if (rowcount >= hypercube.qSize.qcy) {
                            $element.find(".more").hide();
                        }
                        console.log(ClickExport);
                        if( ClickExport === 1 ){
                            var html = createRows(page.qMatrix, hypercube.qDimensionInfo);
                            $element.find("tbody").append(html);
                        }
                        ciclo += 1;
                        
                    });

                    if (rowcount < hypercube.qSize.qcy && rowcount < 200000) {
                        var requestPage = [{
                            qTop: rowcount,
                            qLeft: 0,
                            qWidth: colcount,
                            qHeight: Math.min(1000, hypercube.qSize.qcy - rowcount)
                        }];

                        self.backendApi.getData(requestPage).then(exportAllData);
                    } else {
                        $element.find("#exportToCsv").text("Finalizado");
                        $element.find(".more").hide();
                        if (includeHeaders) {
                            var headers = hypercube.qDimensionInfo.concat(hypercube.qMeasureInfo).map(function (cell) {
                                return cell.qFallbackTitle;
                            });
                            allRows.unshift(headers);
                        }
                        if (layout.props.fileFormat === "csv") {
                            exportToCsv(customFilename, allRows, customDelimiter);
                        } else {
                            exportToTxt(customFilename, allRows, customDelimiter);
                        }
                        rowcount = hypercube.qDataPages[0].qMatrix.length;
                        allRows = [];
                        setTimeout(function() {
                            $element.find("#progressBar").css("width", "0%");
                            $element.find("#progressBar").text("");
                            $element.find("#exportToCsv").text("Exportar a " + layout.props.fileFormat.toUpperCase());
                            $element.find('#exportToCsv').prop('disabled', false);
                        }, 2000); 
                    }

                };

                exportAllData([layout.qHyperCube.qDataPages[0]]);
                ClickExport += 1;
            });


            return qlik.Promise.resolve();
        }
    };
});
