// Generated by CoffeeScript 1.9.1
(function() {
  $(document).ready(function() {
    var curr, navbar, reg, tag;
    $(function() {
      $('#sidebar_content').load('html_snips/sidebar.html');
    });
    $(function() {
      $('#logo_content').load('html_snips/logo.html');
    });
    $(function() {
      $('#footer_content').load('html_snips/footer.html');
    });
    navbar = "<div id=\"menubar\">\n  <ul id=\"menu\">\n    <li><a href=\"index.html\">About Me</a></li>\n    <li><a href=\"academic_record.html\">Academic Record</a></li>\n    <li><a href=\"#\">CV</a></li>\n    <li><a href=\"#\">My Projects</a></li>\n    <li><a href=\"#\">Silly Things</a></li>\n    <li><a href=\"find_me.html\">Find Me</a></li>\n  </ul>\n</div>";
    tag = document.getElementById('navbar');
    curr = tag.getAttribute("curr");
    reg = RegExp("li(?=.*" + curr + ")");
    navbar = navbar.replace(reg, 'li class="current"');
    return tag.innerHTML = navbar;
  });

}).call(this);
