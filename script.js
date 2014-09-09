window.onload = function () {

  var c = document.getElementById('canvas');

  c.width = 500;
  c.height = 300;

  var elmTransparency = document.getElementById('transparency');
  var elmAdd = document.getElementById('add');
  var elmRange = document.getElementById('range');

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
  attLocation[2] = gl.getAttribLocation(prg, 'textureCoord');

  // attributeの要素数を配列に格納
  var attStride = new Array();
  attStride[0] = 3;
  attStride[1] = 4;
  attStride[2] = 2;

  // 頂点の位置情報を格納する配列
  var position = [
    -1.0, 1.0, 0.0,
     1.0, 1.0, 0.0,
    -1.0,-1.0, 0.0,
     1.0,-1.0, 0.0
  ];

  // 頂点の色情報を格納する配列
  var color = [
		1.0, 0.0, 0.0, 1.0,
		0.0, 1.0, 0.0, 1.0,
		0.0, 0.0, 1.0, 1.0,
		1.0, 1.0, 1.0, 1.0
	];

  var textureCoord = [
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    1.0, 1.0
  ];

  // 頂点のインデックスを格納する配列
  var index = [
    0, 1, 2,
    3, 2, 1
  ];

  // VBOとIBOの生成
  var vPosition = create_vbo(position);
  var vColor = create_vbo(color);
  var vTextureCoord = create_vbo(textureCoord);
  var VBOList = [vPosition, vColor, vTextureCoord];
  var iIndex = create_ibo(index);

  // VBOとIBOの登録
  set_attribute(VBOList, attLocation, attStride);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iIndex);

  var m = new matIV();

  var mMatrix = m.identity(m.create());
  var vMatrix = m.identity(m.create());
  var pMatrix = m.identity(m.create());
  var tmpMatrix = m.identity(m.create());
  var mvpMatrix = m.identity(m.create());
  var invMatrix = m.identity(m.create());

  var uniLocation = new Array();
  uniLocation[0] = gl.getUniformLocation(prg, 'mvpMatrix');
  uniLocation[1] = gl.getUniformLocation(prg, 'vertexAlpha');
  uniLocation[2] = gl.getUniformLocation(prg, 'texture');
  uniLocation[3] = gl.getUniformLocation(prg, 'useTexture');

  // 視点の向き
  var eyeDirection = [0.0, 0.0, 5.0];

  // ビュー座標変換行列
  m.lookAt(eyeDirection, [0, 0, 0], [0, 1, 0], vMatrix);
  m.perspective(45, c.width / c.height, 0.1, 100, pMatrix);
  m.multiply(pMatrix, vMatrix, tmpMatrix);

  // 平行光源の向き
  var lightPosition = [0.0, 0.0, 0.0];

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

  // トーラスの描画
  // row: 円の数
  // column: 円一つあたりの頂点数
  // irad: 円の半径
  // orad: トーラス全体の半径
  function torus(row, column, irad, orad){
    var pos = new Array(), nor = new Array(),
        col = new Array(), idx = new Array();
    for(var i = 0; i <= row; i++){
        var r = Math.PI * 2 / row * i;
        var rr = Math.cos(r);
        var ry = Math.sin(r);
        for(var ii = 0; ii <= column; ii++){
            var tr = Math.PI * 2 / column * ii;
            var tx = (rr * irad + orad) * Math.cos(tr);
            var ty = ry * irad;
            var tz = (rr * irad + orad) * Math.sin(tr);
            var rx = rr * Math.cos(tr);
            var rz = rr * Math.sin(tr);
            pos.push(tx, ty, tz);
            nor.push(rx, ry, rz);
            var tc = hsva(360 / column * ii, 1, 1, 1);
            col.push(tc[0], tc[1], tc[2], tc[3]);
        }
    }
    for(i = 0; i < row; i++){
        for(ii = 0; ii < column; ii++){
            r = (column + 1) * i + ii;
            idx.push(r, r + column + 1, r + 1);
            idx.push(r + column + 1, r + column + 2, r + 1);
        }
    }
    return [pos, nor, col, idx];
  }

  // テクスチャの初期化
  var texture = null;
  create_texture("texture.png");
  gl.activeTexture(gl.TEXTURE0);

  // 回常ループ
  (function () {

    //ボタン処理
    if(elmTransparency.checked) blend_type(0);
    if(elmAdd.checked) blend_type(1);

    //透明度の取得
    var vertexAlpha = parseFloat(elmRange.value / 100);

    // canvasを初期化
    gl.clearColor(0.0, 0.75, 0.75, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // カウンタをインクリメント
    count++;

    // カウンタを元にラジアン(0~359)と各種座標を取得
    var rad = (count % 360) * Math.PI / 180;

    // モデル座標変換行列の生成
    m.identity(mMatrix);
    m.translate(mMatrix, [0.25, 0.25, -0.25], mMatrix);
    m.rotate(mMatrix, rad, [0, 1, 0], mMatrix);
    m.multiply(tmpMatrix, mMatrix, mvpMatrix);

    // 有効にするテクスチャユニットを指定・バインド
    // ・テクスチャに登録
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.disable(gl.BLEND);

    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
    gl.uniform1f(uniLocation[1], 1.0);
    gl.uniform1i(uniLocation[2], 0);
    gl.uniform1i(uniLocation[3], true);
    gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);

    m.identity(mMatrix);
		m.translate(mMatrix, [-0.25, -0.25, 0.25], mMatrix);
		m.rotate(mMatrix, rad, [0, 0, 1], mMatrix);
		m.multiply(tmpMatrix, mMatrix, mvpMatrix);

    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.enable(gl.BLEND);

    gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
		gl.uniform1f(uniLocation[1], vertexAlpha);
		gl.uniform1i(uniLocation[2], 0);
		gl.uniform1i(uniLocation[3], false);
		gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);

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

