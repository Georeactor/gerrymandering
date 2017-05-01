var width = 700,
  height = 380;

var projection = d3.geoMercator()
    .center([-76.3, 40.6])
    .scale(6000);

var path = d3.geoPath()
  .projection(projection);

var svg = d3.select("#map").append("svg")
  .attr("width", width)
  .attr("height", height);

function renderDistrict(number, voteInfo) {
  d3.json("topojson/pa-" + number + ".topojson", function(error, district) {
    if (error) {
      throw error;
    }

    var party = "democrat";
    if (voteInfo.republican && (!voteInfo.democrat || voteInfo.democrat.count < voteInfo.republican.count)) {
      party = "republican";
    }
    var contested = (!voteInfo.republican || !voteInfo.democrat) ? "uncontested" : "contested";

    var feature = topojson.feature(district, district.objects['pa-' + number]);
    var mega_center = projection.invert(path.centroid(feature));
    mega_center[0] += 1.3;
    mega_center[1] -= 0.4;
    var mega_me = d3.geoMercator().scale(8000).center(mega_center);
    var is_mega = false;

    svg.insert("path")
      .datum(feature)
      .attr("class", ["district", party, contested].join(" "))
      .attr("d", path)
      .on("click", function() {
        var border = d3.select(this);
        if (border.classed('dull') && !is_mega) {
          return;
        }
        
        is_mega = !is_mega;
        d3.selectAll(".district").classed("dull", is_mega);
        border
          .classed("mega", is_mega)
          .attr("d", is_mega ? path.projection(mega_me) : path.projection(projection));
        if (is_mega) {
          border.raise();
        }
/*
        d3.selectAll(".district").style("fill", "#fc3c2f");
        d3.select(this).style("fill", "#00f");
*/
      });
  });
}

var votesByDistrict = {};

d3.json("vote-totals.json", function(err, districts) {
  if (err) {
    throw err;
  }
  votesByDistrict = districts;

  for (var d = 1; d <= 18; d++) {
    renderDistrict(d, districts[d + ""]);
  }
});

d3.select("#contested").on("change", function() {
  d3.selectAll(".uncontested").classed("hide", !this.checked);
});
