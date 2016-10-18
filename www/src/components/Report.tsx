import * as React from "react";
import { Checkbox, Panel, Table } from "react-bootstrap";
import { Col, Row, Button } from "react-bootstrap";
import { BDRateReport, Report, AppStore, Jobs, Job, JobStatus, loadXHR, ReportField, reportFieldNames, metricNames, metricNameToReportFieldIndex} from "../stores/Stores";

declare var require: any;

let Select = require('react-select');
let copyToClipboard = require('copy-to-clipboard');

function formatNumber(n) {
  return n.toLocaleString(); // .replace(/\.00$/, '');
}
function makeTableCell(key: any, v: number, color: boolean = false, formatter = formatNumber) {
  let className = "tableValue";
  if (color) {
    if (v > 0) {
      className = "positiveTableValue";
    } else if (v < 0) {
      className = "negativeTableValue";
    }
  }
  return <td key={key} className={className}>{formatter(v)}</td>
}

interface VideoReportProps {
  name?: string;
  job: Job;
  highlightColumns?: string [];
  filterQualities?: number [];
}

export class VideoReportComponent extends React.Component<VideoReportProps, {
  jobReport: Report;
}> {
  constructor() {
    super();
    this.state = {jobReport: null};
  }
  componentWillReceiveProps(nextProps: VideoReportProps, nextContext: any) {
    if (this.props.job !== nextProps.job) {
      this.loadReport("jobReport", nextProps.job);
    }
  }
  loadReport(name: string, job: Job) {
    if (job) {
      job.loadReport().then((report) => {
        this.setState({[name]: report} as any);
      });
    } else {
      this.setState({[name]: null} as any);
    }
  }
  componentDidMount() {
    this.loadReport("jobReport", this.props.job);
  }
  render() {
    // console.debug("Rendering Video Report");
    let highlightColumns = this.props.highlightColumns;
    function tableHeaderClassName(name) {
      if (highlightColumns && highlightColumns.indexOf(name) >= 0) {
        return "highlightedTableHeader";
      }
      return "tableHeader";
    }
    let headers = reportFieldNames.map(name =>
      <th key={name} className={tableHeaderClassName(name)}>{name}</th>
    );

    let rows = [];
    let name = this.props.name;
    let jobVideoReport = this.state.jobReport ? this.state.jobReport[name] : null;
    if (!jobVideoReport) {
      return null;
    }
    jobVideoReport.forEach(row => {
      if (this.props.filterQualities.length &&
          this.props.filterQualities.indexOf(row[0]) < 0) {
        return;
      }
      let cols = row.map((v, i) => {
        return <td key={i} className="tableValue">{formatNumber(v)}</td>
      });
      rows.push(<tr key={row[0]}>{cols}</tr>);
    });
    let table = <div>
      <Table striped bordered condensed hover style={{width: "100%"}}>
        <thead>
          <tr>
            {headers}
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </Table>
    </div>
    return table;
  }
}

interface BDRateReportProps {
  a: Job,
  b: Job
}

export class BDRateReportComponent extends React.Component<BDRateReportProps, {
  report: BDRateReport;
  reversed: boolean;
}> {
  constructor() {
    super();
    this.state = { report: null, reversed: false } as any;
  }
  componentWillReceiveProps(nextProps: BDRateReportProps, nextContext: any) {
    if (this.props.a !== nextProps.a || this.props.b !== nextProps.b) {
      this.loadReport(nextProps);
    }
  }
  loadReport(props: BDRateReportProps) {
    let a = props.a;
    let b = props.b;
    if (!a || !b) {
      return;
    }
    this.setState({report: null} as any);
    AppStore.loadBDRateReport(a, b, a.task).then((report) => {
      this.setState({report} as any);
    });
  }
  componentWillMount() {
    this.loadReport(this.props);
  }
  onReverseClick() {
    let report = this.state.report;
    this.setState({reversed: !this.state.reversed} as any);
    this.loadReport({a: report.b, b: report.a});
  }
  onCopyToClipboardClick() {
    function padTable(rows: any [][]) {
      let numCols = rows[0].length;
      let maxColWidths = new Uint32Array(numCols);
      for (let i = 0; i < numCols; i++) {
        for (let j = 0; j < rows.length; j++) {
          maxColWidths[i] = Math.max(maxColWidths[i], rows[j][i].length);
        }
      }
      function padLeft(s, l, c) {
        while (s.length < l)
            s = c + s;
        return s;
      }
      function padRight(s, l, c) {
        while (s.length < l)
            s = s + c;
        return s;
      }
      for (let i = 0; i < numCols; i++) {
        for (let j = 0; j < rows.length; j++) {
          rows[j][i] = padLeft(rows[j][i], maxColWidths[i], ' ');
        }
      }
    }

    let a = this.props.a;
    let b = this.props.b;
    let report = this.state.report;
    let summaryHeaders = ["PSNR", "PSNR Cb", "PSNR Cr", "PSNR HVS", "SSIM", "MS SSIM", "CIEDE 2000"];
    let summaryRows = [summaryHeaders];
    summaryRows.push(summaryHeaders.map(name => report.average[name].toFixed(2)));
    padTable(summaryRows);

    let text = report.a.id + " -> " + report.b.id + "\n\n";
    text += summaryRows.map(row => row.join(" | ")).join("\n");

    function toRow(video: string, data) {
      return [video].concat(report.metricNames.map(name => data[name].toFixed(2)));
    }
    let rowHeaders = ["Video"].concat(report.metricNames);
    let rows = [rowHeaders];
    for (let video in report.metrics) {
      rows.push(toRow(video, report.metrics[video]));
    }
    padTable(rows);
    text += "\n\n";
    text += rows.map(row => row.join(" | ")).join("\n");

    // Markdown
    text += "\n\nMarkdown Version\n\n";
    summaryRows.splice(1, 0, summaryHeaders.map(() => "---"));
    padTable(summaryRows);
    text += summaryRows.map(row => `| ${row.join(" | ")} |`).join("\n");

    text += "\n\n";
    rows.splice(1, 0, rowHeaders.map(() => "---"));
    padTable(rows);
    text += rows.map(row => `| ${row.join(" | ")} |`).join("\n");
    copyToClipboard(text);
  }
  render() {
    // console.debug("Rendering BDRateReport");
    let a = this.props.a;
    let b = this.props.b;
    let report = this.state.report;
    if (a && b) {
      if (!report) {
        return <Panel header={"BD Rate Report"}>
          <span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Loading report ...
        </Panel>
      }
    } else {
      return <Panel header={"BD Rate Report"}>
        Select two jobs.
      </Panel>
    }
    let headers = [<th key="video" className="tableHeader">Video</th>];
    headers = headers.concat(report.metricNames.map(name => <th key={name} className="tableHeader">{name}</th>));

    let rows = [];
    function toRow(video: string, data, big = false) {
      let cols = [<td key={"fileName"} className="longTableValue">{video}</td>];
      cols = cols.concat(report.metricNames.map(name =>
        makeTableCell(name, data[name], true, (n) => n.toFixed(2))
      ));
      return <tr key={video} className={big ? "bigRow" : ""}>{cols}</tr>
    }
    rows.push(toRow("Average", report.average, true));
    for (let video in report.metrics) {
      rows.push(toRow(video, report.metrics[video]));
    }
    return <Panel header={`BD Rate Report ${report.a.selectedName + " " + report.a.id} → ${report.b.selectedName + " " + report.b.id}`}>
      <div style={{ paddingBottom: 8, paddingTop: 4 }}>
        <Button active={this.state.reversed} onClick={this.onReverseClick.bind(this)} >Reverse</Button>{' '}
        <Button active={this.state.reversed} onClick={this.onCopyToClipboardClick.bind(this)} >Copy to Clipboard</Button>
      </div>
      <Table striped bordered condensed hover style={{width: "100%"}}>
        <thead>
          <tr>
            {headers}
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </Table>
    </Panel>
  }
}