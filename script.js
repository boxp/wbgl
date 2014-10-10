window.onload = function () {

  // canvasとクォータニオンをグローバル変数とする
  var c = document.getElementById('canvas');

  // input rangeエレメント
   var eLines     = document.getElementById('lines');
	var eLineStrip = document.getElementById('line_strip');
	var eLineLoop  = document.getElementById('line_loop');
	var ePointSize = document.getElementById('point_size');

  var q = new qtnIV();
  var qt = q.identity(q.create());

  // マウスムーブイベントリスナ
  function mouseMove(e) {
    var cw = c.width;
    var ch = c.height;
    var wh = 1 / Math.sqrt(cw * cw + ch * ch);
    var x = e.clientX - c.offsetLeft - cw * 0.5;
    var y = e.clientY - c.offsetTop - ch * 0.5;
    var sq = Math.sqrt(x * x + y * y);
    var r = sq * 2.0 * Math.PI * wh;
    if (sq != 1) {
      sq = 1 / sq;
      x *= sq;
      y *= sq;
    }
    q.rotate(r, [y, x, 0.0], qt);
  }

  c.width = 500;
  c.height = 300;

  c.addEventListener('mousemove', mouseMove, true);

  var gl = c.getContext('webgl') || c.getContext('experimental-webgl');

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var v_shader = create_shader('vs');
  var f_shader = create_shader('fs');

  var prg = create_program(v_shader, f_shader);

  // attributeLocationを配列に登録
  var attLocation = new Array();
  attLocation[0] = gl.getAttribLocation(prg, 'position');
  attLocation[1] = gl.getAttribLocation(prg, 'color');

  // attributeの要素数を配列に格納
  var attStride = new Array();
  attStride[0] = 3;
  attStride[1] = 4;

  // 点のVBO生成
  var pointSphere = sphere(16, 16, 2.0);
  var pPos = create_vbo(pointSphere.p);
  var pCol = create_vbo(pointSphere.c);
  var pVBOList = [pPos, pCol];

  // 線の頂点位置
  var position = [
    -1.0, -1.0, 0.0,
     1.0, -1.0, 0.0,
    -1.0,  1.0, 0.0,
     1.0,  1.0, 0.0
  ];

  // 線の頂点色
  var color = [
       1.0, 1.0, 1.0, 1.0,
       1.0, 0.0, 0.0, 1.0,
       0.0, 1.0, 0.0, 1.0,
       0.0, 0.0, 1.0, 1.0
  ];

  // 頂点のインデックスを格納する配列
  var index = [
    0, 1, 2,
    3, 2, 1
  ];

  // 線のVBO生成
  var lPos = create_vbo(position);
  var lCol = create_vbo(color);
  var lVBOList = [lPos, lCol];

  var m = new matIV();
  
  // 四元数の宣言と初期化
  var aQuaternion = q.identity(q.create());
  var bQuaternion = q.identity(q.create());
  var sQuaternion = q.identity(q.create());

  var mMatrix = m.identity(m.create());
  var vMatrix = m.identity(m.create());
  var pMatrix = m.identity(m.create());
  var tmpMatrix = m.identity(m.create());
  var mvpMatrix = m.identity(m.create());
  var invMatrix = m.identity(m.create());
  var qMatrix = m.identity(m.create());

  var uniLocation = new Array();
  uniLocation[0] = gl.getUniformLocation(prg, 'mvpMatrix');
  uniLocation[1] = gl.getUniformLocation(prg, 'pointSize');

  // 視点の向き
  var eyeDirection = [0.0, 0.0, 5.0];

  // カメラの座標
  var camPosition = [0.0, 0.0, 10.0];

  // カメラの上方向を表すベクトル
  var camUpDirection = [0.0, 1.0, 0.0];

  // 環境光
  var ambientColor = [0.1, 0.1, 0.1, 1.0];

  // 平行光源の向き
  var lightPosition = [15.0, 10.0, 15.0];

  // カウンタ
  var count = 0;

  // HSV to RGB
  function hsva(h, s, v, a){
    if(s > 1 || v > 1 || a > 1){return;}
    var th = h % 360;
    var i = Math.floor(th / 60);
    var f = th / 60 - i;
    var m = v * (1 - s);
    var n = v * (1 - s * f);
    var k = v * (1 - s * (1 - f));
    var color = new Array();
    if(!s > 0 && !s < 0){
        color.push(v, v, v, a); 
    } else {
        var r = new Array(v, n, m, m, k, v);
        var g = new Array(k, v, v, n, m, m);
        var b = new Array(m, m, k, v, v, n);
        color.push(r[i], g[i], b[i], a);
    }
    return color;
  } 

  // パラメーターの設定
  gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);
	gl.enable(gl.BLEND);
  
  // ブレンドファクター
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);

  var texture0 = null;
  var texture1 = null;

  // テクスチャの読み込み
  create_texture('texture0.png', 0);
  create_texture('texture1.png', 1);


  // 回常ループ
  (function () {

    // canvasの初期化
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clearDepth(1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
		// カウンタ・基底角度の更新
		count++;
		var rad = (count % 360) * Math.PI / 180;
		
		// クォータニオンと行列の初期化
		var qMatrix = m.identity(m.create());
		q.toMatIV(qt, qMatrix);
		
		// モデル行列の生成
		var camPosition = [0.0, 5.0, 10.0];
		m.lookAt(camPosition, [0, 0, 0], [0, 1, 0], vMatrix);
		m.multiply(vMatrix, qMatrix, vMatrix);
		m.perspective(45, c.width / c.height, 0.1, 100, pMatrix);
		m.multiply(pMatrix, vMatrix, tmpMatrix);
		
		// 点のサイズを計算
		var pointSize = ePointSize.value / 10;
		
		// 
		set_attribute(pVBOList, attLocation, attStride);
		m.identity(mMatrix);
		m.rotate(mMatrix, rad, [0, 1, 0], mMatrix);
		m.multiply(tmpMatrix, mMatrix, mvpMatrix);
		gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
		gl.uniform1f(uniLocation[1], pointSize);
		gl.drawArrays(gl.POINTS, 0, pointSphere.p.length / 3);
		
		var lineOption = 0;
		if(eLines.checked){lineOption = gl.LINES;}
		if(eLineStrip.checked){lineOption = gl.LINE_STRIP;}
		if(eLineLoop.checked){lineOption = gl.LINE_LOOP;}
		
		set_attribute(lVBOList, attLocation, attStride);
		m.identity(mMatrix);
		m.rotate(mMatrix, Math.PI / 2, [1, 0, 0], mMatrix);
		m.scale(mMatrix, [3.0, 3.0, 1.0], mMatrix);
		m.multiply(tmpMatrix, mMatrix, mvpMatrix);
		gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
		gl.drawArrays(lineOption, 0, position.length / 3);
		
    // コンテキストの再描画
    gl.flush();

    // ループのための再帰呼び出し
    setTimeout(arguments.callee, 1000 / 60);

  })();

  // IBOを生成する関数
  function create_ibo(data) {
    // バッファオブジェクトの生成
    var ibo = gl.createBuffer();

    // バッファをバインドする
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

    // バッファにデータをセット
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), gl.STATIC_DRAW);

    // バッファのバインドを無効化
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return ibo;

  }

  // モデル行列から変換行列を完成させレンダリングする
  function render_model(mMatrix) {
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);
    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  function set_attribute(vbo, attL, attS) {
    // 引数として受け取った配列を処理する
    for (var i in vbo) {
      // バッファをバインド
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo[i]);

      // attributeLocationを有効にする
      gl.enableVertexAttribArray(attL[i]);

      // attributeLocationを通知し登録する
      gl.vertexAttribPointer(attL[i], attS[i], gl.FLOAT, false, 0, 0);

    }
  }

  function create_shader(id) {
    var shader;

    var scriptElement = document.getElementById(id);

    if(!scriptElement){return;};

    switch(scriptElement.type) {
      case "x-shader/x-vertex":
        shader = gl.createShader(gl.VERTEX_SHADER);
        break;

      case "x-shader/x-fragment":
        shader = gl.createShader(gl.FRAGMENT_SHADER);
        break;

      default:
        return;
    }

    // 生成されたシェーダーにソースを割り当てる
    gl.shaderSource(shader, scriptElement.text);

    gl.compileShader(shader);

    if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return shader;
    } else {
      alert(gl.getShaderInfoLog(shader));
    }
  }

  function create_program(vs, fs) {
    var program = gl.createProgram();

    // プログラムオブジェクトにシェーダーを割り当てる
    gl.attachShader(program,vs);
    gl.attachShader(program,fs);

    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);
      return program;
    } else {
      alert(gl.getProgramInfoLog(program));
    }
  }

  function create_vbo(data) {
    var vbo = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vbo;
  }

  function create_texture(source, number) {
    // イメージオブジェクトの生成
    var img = new Image();

    // データのオンロードをトリガーとする
    img.onload = function () {
      var tex = gl.createTexture();

      // テクスチャをバインドする
      gl.bindTexture(gl.TEXTURE_2D, tex);

      // テクスチャへイメージを適用
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      // ミップマップを生成
      gl.generateMipmap(gl.TEXTURE_2D);

      // テクスチャのバインドを無効化
      gl.bindTexture(gl.TEXTURE_2D, null);

      // 生成したテクスチャをグローバル変数に格納
      switch(number) {
        case 0:
          texture0 = tex;
          break;
        case 1:
          texture1 = tex;
          break;
        default:
          texture = tex;
          break;
      };
    };

    // イメージオブジェクトのソースを指定
    img.src = source;
  };

  function blend_type(prm) {
    switch(prm) {
      //透過処理
      case 0:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
      //加算合成
      case 1:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
      default:
        break;
    }
  }
}

// 球体を生成する関数
function sphere(row, column, rad, color){
    var pos = new Array(), nor = new Array(),
        col = new Array(), idx = new Array();
    for(var i = 0; i <= row; i++){
        var r = Math.PI / row * i;
        var ry = Math.cos(r);
        var rr = Math.sin(r);
        for(var ii = 0; ii <= column; ii++){
            var tr = Math.PI * 2 / column * ii;
            var tx = rr * rad * Math.cos(tr);
            var ty = ry * rad;
            var tz = rr * rad * Math.sin(tr);
            var rx = rr * Math.cos(tr);
            var rz = rr * Math.sin(tr);
            if(color){
                var tc = color;
            }else{
                tc = hsva(360 / row * i, 1, 1, 1);
            }
            pos.push(tx, ty, tz);
            nor.push(rx, ry, rz);
            col.push(tc[0], tc[1], tc[2], tc[3]);
        }
    }
    r = 0;
    for(i = 0; i < row; i++){
        for(ii = 0; ii < column; ii++){
            r = (column + 1) * i + ii;
            idx.push(r, r + 1, r + column + 2);
            idx.push(r, r + column + 2, r + column + 1);
        }
    }
    return {p : pos, n : nor, c : col, i : idx};
}

