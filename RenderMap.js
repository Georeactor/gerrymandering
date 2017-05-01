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

function renderDistrict(number) {
  d3.json("topojson/pa-" + number + ".topojson", function(error, district) {
    if (error) {
      throw error;
    }
    svg.insert("path")
      .datum(topojson.feature(district, district.objects['pa-' + number]))
      .attr("class", "district")
      .attr("d", path)
      .on("click", function() {
        d3.selectAll(".district").style("fill", "#fc3c2f");
        d3.select(this).style("fill", "#00f");
      });
  });
}

for (var d = 1; d <= 18; d++) {
  renderDistrict(d);
}
