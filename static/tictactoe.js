console.clear();

var gameApp = angular.module('game', [])
    .config(function ($interpolateProvider) {
      $interpolateProvider.startSymbol('{[{').endSymbol('}]}');
    });

gameApp.controller('gameCtrl', function ($scope) {
  var sock = null;
  $scope.init = function () {

    $scope.cellsList = []
    for (i = 0; i < 9; i++) {
      $scope.cellsList.push({id: i, state: '', symbol: ''})
    }

    $scope.showIntroState = true;
    $scope.fillCellsFalseData();

    $scope.userChoiceShow = false;
    $scope.showMessageState = false;

    $scope.stepsDone = 0;

    $scope.winCombo = [
      {line: [0, 1, 2]},
      {line: [3, 4, 5]},
      {line: [6, 7, 8]},

      {line: [0, 3, 6]},
      {line: [1, 4, 7]},
      {line: [2, 5, 8]},

      {line: [0, 4, 8]},
      {line: [2, 4, 6]}
    ];

    $scope.userSymbol = '';
    $scope.currentSymbol = '';

    $scope.winner = '';
    $scope.winnerX = 'xxx';
    $scope.winnerO = 'ooo';
  };

  $scope.playerNamed = function () {
    return $scope.yourName == null;
  };

  $scope.fillCellsFalseData = function () {
    var falseMap = [
      {cell: 0, symbol: 'o'},
      {cell: 2, symbol: 'x'},
      {cell: 4, symbol: 'x'},
      {cell: 6, symbol: 'o'},
      {cell: 8, symbol: 'o'}
    ];

    $scope.showFalseData = true;

    for (var i = 0; i < falseMap.length; i++) {
      var cell = falseMap[i].cell;
      var symbol = falseMap[i].symbol;
      $scope.cellsList[cell].symbol = symbol;
    }
  };

  $scope.clearCells = function () {
    for (var i = 0; i < $scope.cellsList.length; i++) {
      $scope.cellsList[i].symbol = '';
    }
    $scope.showFalseData = false;
  };

  $scope.init();

  //--------------------------------------

  // Websockets connection
  function connect() {
    console.log('Connecting...');
    $scope.stateInfo = 'Connecting...';
    sock = new SockJS('http://' + window.location.host + '/game');

    sock.onopen = function () {
      if ($scope.yourName) {
        sock.send(JSON.stringify({
              'type': 'name',
              'value': $scope.yourName
            }
        ));
      }
      $scope.$apply();
    };

    sock.onmessage = function (e) {
      console.log('Received: ' + e.data);
      var msg = JSON.parse(e.data);

      if (msg.type == 'start') {
        $scope.secondUser = 'Второй игрок: ' + msg.opponent;
        $scope.selectSymbol(msg.symbol);
        $scope.showIntroState = false;
        $scope.clearCells();
        $scope.stateInfo = msg.text;

        if (msg.symbol == 'x') {
          $scope.showGameState = false;
        } else {
          $scope.stateInfo += ' Ждем ход соперника'
          $scope.showGameState = true;
        }
      }

      if (msg.type == 'waiting') {
        $scope.stateInfo = msg.text;
        $scope.showGameState = true;
        $scope.showIntroState = false;
      }

      if (msg.type == 'disconnect') {
        $scope.message = msg.text;
        $scope.showMessageState = true;
      }

      if (msg.type == 'turn') {
        if (msg.symbol != $scope.userSymbol) {
          $scope.showGameState = false;
          currCell = $scope.cellsList[msg.place];
          $scope.makeStep(currCell, msg.symbol);
        } else if (!$scope.winner) {
          $scope.stateInfo = 'Ждем ход соперника';
          $scope.showGameState = true;
        }
      }

      $scope.$apply();
    };

    sock.onclose = function () {
      sock = null;
      console.log('onclose Disconnecting...');
      $scope.message = 'Соединение прервано. Игра закончилась';
      $scope.showMessageState = true;
      $scope.$apply();
    };
  }

  function disconnect() {
    if (sock != null) {
      console.log('Disconnecting...');
      sock.close();
      sock = null;
    }
    $scope.newGame();
  }

  //--------------------------------------

  // Set player name
  $scope.setName = function () {
    $scope.yourName = $scope.nameText;
    $scope.nameText = '';
    $scope.currentUser = 'Привет, ' + $scope.yourName;
    connect();
  };

  // Choose symbol for first step
  $scope.selectSymbol = function (sym) {
    $scope.userSymbol = sym;
    $scope.currentSymbol = 'x';

    $scope.userChoiceShow = true;
  };

  //--------------------------------------

  $scope.currentStepClass = function () {
    if (!$scope.currentSymbol) {
      if ($scope.showFalseData) {
        return 'current-step--none';
      }
      return;
    }
    return 'current-step--' + $scope.currentSymbol;
  };

  $scope.userSymbolClass = function () {
    if (!$scope.userSymbol) {
      return;
    }
    return 'user-selected-symbol--' + $scope.userSymbol;
  };

  $scope.stepSymbolClass = function () {
    if (!this.cell.symbol) {
      if ($scope.showFalseData) {
        return 'symbols--hidden';
      }
      return;
    }
    return 'symbols--selected symbols--selected-' + this.cell.symbol;

  };

  //--------------------------------------

  // Make step
  $scope.makeStep = function (currCell, sym) {

    if (currCell.state == 'disabled') {
      return;
    }

    currCell.state = 'disabled';
    currCell.symbol = sym;

    sock.send(JSON.stringify(
        {
          'type': 'turn',
          'symbol': sym,
          'place': currCell.id
        }
    ));

    // Switch symbols for next step
    $scope.currentSymbol = (sym == 'o' ? 'x' : 'o');
    $scope.stepsDone++;
    console.log($scope.stepsDone);

    checkResult();
  };

  //--------------------------------------

  function checkLine(item) {

    if (Object.keys(item.unique).length > 1) {
      item.isDisabled = true;
    }

    if (item.cellsStr.length == 3) {
      item.isDisabled = true;

      if (item.cellsStr == $scope.winnerX) {
        $scope.winner = 'x';
        showResult();
      }
      else if (item.cellsStr == $scope.winnerO) {
        $scope.winner = 'o';
        showResult();
      }

      if ($scope.stepsDone == 9) {
        showResult();
      }
    }
  }

  //--------------------------------------

  function filterCells(pos, context) {

    var symbol = $scope.cellsList[pos].symbol;

    if (this.isDisabled
        || symbol == '') {
      return this;
    }

    if (!this.cells) {
      this.cells = [];
      this.cellsStr = '';
      this.unique = {};
    }

    if (!this.cells[pos]) {
      this.cells[pos] = symbol;
      this.cellsStr += symbol;
      this.unique[symbol] = symbol;

      checkLine(this);
    }

    return context;
  }

  //--------------------------------------

  function eachCombo(item, i) {

    if (item.isDisabled) {
      return;
    }

    item.line.forEach(filterCells, item);

  }

  //--------------------------------------

  function checkResult() {

    for (var i = 0; i < $scope.winCombo.length; i++) {
      eachCombo($scope.winCombo[i], i);

      if ($scope.winner) {
        break;
      }
    }
  }

  //--------------------------------------

  function showResult() {

    if ($scope.winner) {

      if ($scope.winner == $scope.userSymbol) {
        $scope.message = 'Вы выиграли!';
      }
      else {
        $scope.message = 'Вы проиграли :(';
      }
    }
    else if ($scope.stepsDone == 9) {
      $scope.message = 'Ничья';
    }

    $scope.showGameState = false;
    $scope.showMessageState = true;
  }

  //--------------------------------------

  $scope.newGame = function () {
    //sock.close();
    $scope.init();
    connect();
  };

}); // gameCtrl
