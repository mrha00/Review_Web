        if (!Object.values) {
            Object.values = function(obj) {
                if (obj === null || typeof obj === 'undefined') {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                const res = [];
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        res.push(obj[key]);
                    }
                }
                return res;
            };
        }

        // ================= 系统核心逻辑 =================
        let currentPaper = [];
        let selectedAnswers = new Map();
        let currentScore = 0;
        let totalScore = 0;
        let currentQuestionIndex = 0; // 当前显示的题目索引
        let consecutiveCorrectStreak = 0; // 新增：追踪连续答对题目数量
        let lastCorrectlyAnsweredQId = null; // 新增：防止同一题重复计入 streak
        let quizStartTime = null; // 新增：记录测验开始时间
        let timeEstimationInterval = null; // 新增：用于定期更新时间预测的interval ID
        let questionsToReview = new Set(); // 新增：存储待复查的题号
        let longPressTimer = null;
        const LONG_PRESS_DURATION = 700; // ms

        // 新增数据统计面板对象
        const analyticsData = {
            timeSpent: {},      // 每题耗时 (例如 { qid: timeInMs })
            accuracyRate: {},   // 题型正确率 (例如 { '单选': {correct: 5, total: 10}, '多选': {} })
            knowledgeMap: {}    // 知识点掌握热力图 (这个结构比较复杂，取决于知识点的定义和关联方式)
        };

        // 添加保存和恢复答题状态的功能
        const STORAGE_KEY = 'quiz_state';

        // 保存答题状态到本地存储
        function saveQuizState(paperName) {
            const state = {
                paperName: paperName || document.getElementById('quiz-title').textContent,
                answers: Array.from(selectedAnswers.entries()),
                score: currentScore,
                review: Array.from(questionsToReview),
                timestamp: new Date().getTime()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }

        // 从本地存储恢复答题状态
        function loadQuizState() {
            const stateJson = localStorage.getItem(STORAGE_KEY);
            if (!stateJson) return null;
            
            try {
                const state = JSON.parse(stateJson);

                // Safely reconstruct selectedAnswers
                if (state.answers && Array.isArray(state.answers)) {
                    selectedAnswers = new Map(
                        state.answers.map(([key, value]) => {
                            // Ensure value is iterable before creating a Set, or default to empty Set
                            const ansSet = (Array.isArray(value)) ? new Set(value) : new Set();
                            return [key, ansSet];
                        })
                    );
                } else {
                    selectedAnswers = new Map(); // Default to empty map
                    if (state.answers) {
                        console.warn('Invalid or non-array "answers" data found in saved state. Initializing selectedAnswers to empty Map. Data was:', state.answers);
                    }
                }

                // Safely reconstruct questionsToReview
                questionsToReview = new Set(Array.isArray(state.review) ? state.review : []);
                if (state.review && !Array.isArray(state.review)) {
                console.warn('Invalid or non-array "review" data found in saved state. Initializing questionsToReview to empty Set. Data was:', state.review);
                }

                return state;
            } catch (e) {
                console.error('加载答题状态失败:', e);
                localStorage.removeItem(STORAGE_KEY); // Clear corrupted state to prevent future errors
                return null;
            }
        }

        // 清除本地存储的答题状态
        function clearQuizState() {
            localStorage.removeItem(STORAGE_KEY);
        }

        // 试卷数据直接硬编码到函数中
        const examPapers = {
    "试卷01": [
        {
            "题号": 1,
            "题型": "单选",
            "分值": 2,
            "题目": "下面选项中，可以设置页面中某个 DIV 标签相对页面水平居中的 CSS 样式是？",
            "选项": [
                "A、 margin:0 auto;",
                "B、 padding:0 auto;",
                "C、 text-align:center;",
                "D、 vertical-align:middle"
            ],
            "答案": [0]
        },
        {
            "题号": 2,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项）下列语句中能够正确的在一个 HTML 页面中导入在同一目录下的\"StyleSheet1.css\"样式表的是？",
            "选项": [
                "A、 `<style>@import StyleSheet1.css;</style>`",
                "B、 `<link rel=\"stylesheet\" type=\"text/css\" href=\"StyleSheet1.css\">`",
                "C、 `<link rel=\"StyleSheet1.css\" type=\"text/css\">`",
                "D、 `<style rel=\"stylesheet\" type=\"text/css\" href=\"StyleSheet1.css\"></style>`"
            ],
            "答案": [0,1]
        },
        {
            "题号": 3,
            "题型": "单选",
            "分值": 2,
            "题目": "分组查询是用于（ ）。",
            "选项": [
                "B、 对数据进行分组",
                "A、 对数据进行排序",
                "C、 对数据进行删除",
                "D、 对数据进行更新"
            ],
            "答案": [0]
        },
        {
            "题号": 4,
            "题型": "单选",
            "分值": 2,
            "题目": "查询 book 表中所有书名中包含 \"计算机\" 的书籍情况，可用（ ）语句。",
            "选项": [
                "B、 SELECT * FROM book WHERE book_name LIKE '计算机%'",
                "A、 SELECT * FROM book WHERE book_name LIKE '计算机*'",
                "C、 SELECT * FROM book WHERE book_name = '计算机*'",
                "D、 SELECT * FROM book WHERE book_name = '计算机%'"
            ],
            "答案": [0]
        },
        {
            "题号": 5,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项） SQLServer 物理存储主要包含哪些文件（ ）。",
            "选项": [
                "A、 主数据文件",
                "B、 次数据文件",
                "C、 事务日志文件",
                "D、 表文件"
            ],
            "答案": [0,1,2]
        },
        {
            "题号": 6,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 下列哪两项不属于聚合函数（ ）。",
            "选项": [
                "A、 LEN (字段)",
                "B、 AVG()",
                "C、 SUM (字段)",
                "D、 COUNT()"
            ],
            "答案": [0,3]
        },
        {
            "题号": 7,
            "题型": "单选",
            "分值": 2,
            "题目": "C# 中下列泛型集合声明正确的是（ ）。",
            "选项": [
                "A、 List<int> f = new List<int>()",
                "B、 List<int> f = new List()",
                "C、 List f = new List()",
                "D、 List<int> f = new List<int>"
            ],
            "答案": [0]
        },
        {
            "题号": 8,
            "题型": "单选",
            "分值": 2,
            "题目": "Lambda 表达式的主要目的是（ ）。",
            "选项": [
                "B、 简化委托の使用",
                "A、 减少代码行数",
                "C、 替代类的构造函数",
                "D、 实现多重继承"
            ],
            "答案": [0]
        },
        {
            "题号": 9,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 以下关于 C# 中方法重载的说法正确的是（ ）。",
            "选项": [
                "A、 如两个方法名字不同，而参数的数量不同，那么它们可以构成方法重载",
                "B、 如两个方法名字相同，而返回值的数据类型不同，那么它们可以构成方法重载",
                "C、 如两个方法名字相同，而参数的数据类型不同，那么它们可以构成方法重载",
                "D、 如两个方法名字相同，而参数的数量不同，那么它们可以构成方法重载"
            ],
            "答案": [2,3]
        },
        {
            "题号": 10,
            "题型": "单选",
            "分值": 2,
            "题目": "类的以下特性中，可以用于方便地重用已有的代码和数据的是（ ）。",
            "选项": [
                "C、 继承",
                "A、 多态",
                "B、 封装",
                "D、 抽象"
            ],
            "答案": [0]
        },
        {
            "题号": 11,
            "题型": "单选",
            "分值": 2,
            "题目": "在ADO.NET中，下列代码运行后的输出结果是（ ）？",
            "选项": [
                "B、 System.Single",
                "A、 System.Int16",
                "C、 编号",
                "D、 成绩"
            ],
            "答案": [0]
        },
        {
            "题号": 12,
            "题型": "单选",
            "分值": 2,
            "题目": "下列哪个类型的对象是ADO.NET在非连接模式下处理数据内容的主要对象（ ）？",
            "选项": [
                "D、 DataSet",
                "A、Command",
                "B、Connection",
                "C、DataAdapter"
            ],
            "答案": [0]
        },
        {
            "题号": 13,
            "题型": "单选",
            "分值": 2,
            "题目": "下面的（ ）对象可用于使服务器获取从客户端浏览器提交或者上传的信息。",
            "选项": [
                "C、 Request",
                "A、 Response",
                "B、 Server",
                "D、 Session"
            ],
            "答案": [0]
        },
        {
            "题号": 14,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项） 从数据库读取记录，你可能用到的方法有（ ）？",
            "选项": [
                "A、 ExecuteNonQuery",
                "B、 ExecuteScalar",
                "C、 Fill",
                "D、 ExecuteReader"
            ],
            "答案": [1,2,3]
        },
        {
            "题号": 15,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 下列（ ) 属于 DataSet 的特点。",
            "选项": [
                "A、 用于读取只读，只进的数据",
                "B、 在断开数据库连接的时候可以操作数据",
                "C、 DataSet 的数据存储在数据库服务器的内存中",
                "D、 不直接和数据库打交道，与数据库的类型没有关系"
            ],
            "答案": [1,3]
        },
        {
            "题号": 16,
            "题型": "单选",
            "分值": 2,
            "题目": "在 C# WinForms 程序中，以下哪项文件属于主程序文件（ ）。",
            "选项": [
                "D、 Program.cs",
                "A、 Properties.cs",
                "B、 Form1.cs",
                "C、 Form1.Designer.cs"
            ],
            "答案": [0]
        },
        {
            "题号": 17,
            "题型": "单选",
            "分值": 2,
            "题目": "在 WinForm 中，如何获取用户选中的复选框（ ）？",
            "选项": [
                "A、 使用 Checked 属性",
                "B、 使用 SelectedIndex 属性",
                "C、 使用 SelectedItem 属性",
                "D、 以上都不对"
            ],
            "答案": [0]
        },
        {
            "题号": 18,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 在 Winforms 窗体中，有关 ListView 控件，运行下面代码后，下列说法错误的是（ ）。",
            "选项": [
                "A、 将选择的所有的列表的文本值改为\"ABC\"",
                "B、 将选择的第一项的文本值改为\"ABC\"",
                "C、 当没有选择任何项的时候，程序出错",
                "D、 当选择只有一项的时候，程序出错"
            ],
            "答案": [0,1]
        },
        {
            "题号": 19,
            "题型": "单选",
            "分值": 2,
            "题目": "下列（ ）不是 WinForm 界面控件？",
            "选项": [
                "D、 Span",
                "A、 Button",
                "B、 TextBox",
                "C、 Label"
            ],
            "答案": [0]
        },
        {
            "题号": 20,
            "题型": "单选",
            "分值": 2,
            "题目": "一个公司可以接纳多名职员参加工作，但是一个职员只能在一个公司工作，从公司到职员之间的联系类型是（ ）。",
            "选项": [
                "D、 一对多",
                "A、 多对多",
                "B、 一对一",
                "C、 多对一"
            ],
            "答案": [0]
        },
        {
            "题号": 21,
            "题型": "单选",
            "分值": 2,
            "题目": "用户自定义异常类需要从以下哪个类继承（ ）。",
            "选项": [
                "A、 Exception",
                "B、 CustomException",
                "C、 ApplicationException",
                "D、 BaseException"
            ],
            "答案": [0]
        },
        {
            "题号": 22,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项） 在数组中，对于 for 和 foreach 语句，下列哪些选项中的说法正确（ ）？",
            "选项": [
                "A、 foreach 语句能使你不用索引就可以遍历整个数组",
                "B、 foreach 语句总是遍历整个数组",
                "C、 foreach 语句总是从索引 1 遍历到索引 Length",
                "D、 如果需要修改数组元素就必须使用 for 语句"
            ],
            "答案": [0,1,3]
        },
        {
            "题号": 23,
            "题型": "单选",
            "分值": 2,
            "题目": "DataReader 对象的（ ）方法用于从查询结果中读取行。",
            "选项": [
                "B、 Read",
                "A、 Next",
                "C、 NextResult",
                "D、 Write"
            ],
            "答案": [0]
        },
        {
            "题号": 24,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 在 WinForms 应用程序中，以下哪些方法可以用来创建和处理多选题（ ）？",
            "选项": [
                "A、 使用 RadioButton 控件并为每个选项创建一个实例",
                "B、 使用 CheckBox 控件并为每个选项创建一个实例",
                "C、 使用 ListBox 控件并设置其 SelectionMode 属性为 MultiSimple",
                "D、 使用 ComboBox 控件并设置其 DropDownStyle 属性为 DropDownList"
            ],
            "答案": [1,2]
        }
    ],
    "试卷02": [
        {
            "题号": 1,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项）有关选择器说法不正确的是？",
            "选项": [
                "A、 类选择器只能应用于某一类 HTML 元素",
                "B、 ID 选择器可以重复使用",
                "C、 标签选择器的优先级高于类选择器",
                "D、 ID 选择器的优先级高于类选择器"
            ],
            "答案": [0,1,2]
        },
        {
            "题号": 2,
            "题型": "单选",
            "分值": 2,
            "题目": "要使列表菜单变成横向的，关键是下面哪句代码？",
            "选项": [
                "A、 #menu ul { list-style: none; margin: 0px; padding: 0px; }",
                "B、 #menu ul li { float:left; }",
                "C、 #menu ul li a { display:block; padding: 0px 8px; height: 26px; line-height: 26px; float:left; }",
                "D、 #menu ul li a:hover { background:#333; color:#fff; }"
            ],
            "答案": [1]
        },
        {
            "题号": 3,
            "题型": "单选",
            "分值": 2,
            "题目": "在CSS中，清除浮动的正确方法是？",
            "选项": [
                "A、 clear: both;",
                "B、 float: none;",
                "C、 display: block;",
                "D、 visibility: hidden;"
            ],
            "答案": [0]
        },
        {
            "题号": 4,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项）下列哪些是CSS盒模型的组成部分？",
            "选项": [
                "A、 content",
                "B、 padding",
                "C、 margin",
                "D、 border-radius"
            ],
            "答案": [0,1,2]
        },
        {
            "题号": 5,
            "题型": "单选",
            "分值": 2,
            "题目": "JavaScript中，typeof null返回的结果是？",
            "选项": [
                "A、 'null'",
                "B、 'object'",
                "C、 'undefined'",
                "D、 'number'"
            ],
            "答案": [1]
        },
        {
            "题号": 6,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项）以下哪些是ES6的新特性？",
            "选项": [
                "A、 let/const声明",
                "B、 函数声明",
                "C、 箭头函数",
                "D、 变量提升"
            ],
            "答案": [0,2]
        },
        {
            "题号": 7,
            "题型": "单选",
            "分值": 2,
            "题目": "在Vue.js中，用于绑定HTML属性的指令是？",
            "选项": [
                "A、 v-model",
                "B、 v-bind",
                "C、 v-if",
                "D、 v-for"
            ],
            "答案": [1]
        },
        {
            "题号": 8,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项）React组件的生命周期方法包括？",
            "选项": [
                "A、 componentDidMount",
                "B、 componentWillUnmount",
                "C、 render",
                "D、 setState"
            ],
            "答案": [0,1,2]
        },
        {
            "题号": 9,
            "题型": "单选",
            "分值": 2,
            "题目": "MySQL中，用于查询数据的关键字是？",
            "选项": [
                "A、 INSERT",
                "B、 UPDATE",
                "C、 SELECT",
                "D、 DELETE"
            ],
            "答案": [2]
        },
        {
            "题号": 10,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项）以下哪些是关系型数据库？",
            "选项": [
                "A、 MySQL",
                "B、 MongoDB",
                "C、 PostgreSQL",
                "D、 Redis"
            ],
            "答案": [0,2]
        },
        {
            "题号": 11,
            "题型": "单选",
            "分值": 2,
            "题目": "在HTTP协议中，状态码200表示？",
            "选项": [
                "A、 资源未找到",
                "B、 请求成功",
                "C、 重定向",
                "D、 服务器错误"
            ],
            "答案": [1]
        },
        {
            "题号": 12,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项）常见的前端性能优化方法包括？",
            "选项": [
                "A、 图片懒加载",
                "B、 减少HTTP请求",
                "C、 使用CDN",
                "D、 嵌套过多CSS选择器"
            ],
            "答案": [0,1,2]
        },
        {
            "题号": 13,
            "题型": "单选",
            "分值": 2,
            "题目": "在Git中，用于提交代码更改的命令是？",
            "选项": [
                "A、 git add",
                "B、 git commit",
                "C、 git push",
                "D、 git pull"
            ],
            "答案": [1]
        },
        {
            "题号": 14,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项）以下哪些是Node.js的内置模块？",
            "选项": [
                "A、 fs",
                "B、 axios",
                "C、 http",
                "D、 react"
            ],
            "答案": [0,2]
        },
        {
            "题号": 15,
            "题型": "单选",
            "分值": 2,
            "题目": "在HTML中，用于定义无序列表的标签是？",
            "选项": [
                "A、 <ol>",
                "B、 <ul>",
                "C、 <li>",
                "D、 <dl>"
            ],
            "答案": [1]
        },
        {
            "题号": 16,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项）以下哪些是CSS定位属性？",
            "选项": [
                "A、 position: static;",
                "B、 position: relative;",
                "C、 position: absolute;",
                "D、 position: float;"
            ],
            "答案": [0,1,2]
        },
        {
            "题号": 17,
            "题型": "单选",
            "分值": 2,
            "题目": "在JavaScript中，数组的pop()方法作用是？",
            "选项": [
                "A、 删除并返回数组的第一个元素",
                "B、 删除并返回数组的最后一个元素",
                "C、 向数组末尾添加元素",
                "D、 反转数组顺序"
            ],
            "答案": [1]
        },
        {
            "题号": 18,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项）以下哪些是前端框架？",
            "选项": [
                "A、 Angular",
                "B、 Django",
                "C、 Vue",
                "D、 Spring"
            ],
            "答案": [0,2]
        },
        {
            "题号": 19,
            "题型": "单选",
            "分值": 2,
            "题目": "在CSS中，设置元素透明度的属性是？",
            "选项": [
                "A、 opacity",
                "B、 visibility",
                "C、 display",
                "D、 z-index"
            ],
            "答案": [0]
        },
        {
            "题号": 20,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项）以下哪些是HTTP请求方法？",
            "选项": [
                "A、 GET",
                "B、 POST",
                "C、 PUT",
                "D、 FILE"
            ],
            "答案": [0,1,2]
        },
        {
            "题号": 21,
            "题型": "单选",
            "分值": 2,
            "题目": "在Python中，用于定义函数的关键字是？",
            "选项": [
                "A、 def",
                "B、 function",
                "C、 class",
                "D、 var"
            ],
            "答案": [0]
        },
        {
            "题号": 22,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项）以下哪些是数据库的事务特性？",
            "选项": [
                "A、 原子性（Atomicity）",
                "B、 一致性（Consistency）",
                "C、 隔离性（Isolation）",
                "D、 可维护性（Maintainability）"
            ],
            "答案": [0,1,2]
        },
        {
            "题号": 23,
            "题型": "单选",
            "分值": 2,
            "题目": "在Java中，用于异常处理的关键字是？",
            "选项": [
                "A、 try-catch",
                "B、 if-else",
                "C、 for",
                "D、 switch"
            ],
            "答案": [0]
        },
        {
            "题号": 24,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项）以下哪些是面向对象的三大特性？",
            "选项": [
                "A、 封装",
                "B、 继承",
                "C、 多态",
                "D、 抽象"
            ],
            "答案": [0,1,2]
        }
    ],
    "试卷03": [
        {
            "题号": 1,
            "题型": "单选",
            "分值": 2,
            "题目": "合并单元格 3 列为 1 列，下面设置正确的是（ ）？",
            "选项": [
                "A、 <td colspan=\"3\"></td>",
                "B、 <td rowspan=\"3\"></td>",
                "C、 <td cols=\"3\"></td>",
                "D、 <td rows=\"3\"></td>"
            ],
            "答案": [0]
        },
        {
            "题号": 2,
            "题型": "单选",
            "分值": 2,
            "题目": "给页面添加背景色，需要设置属性的标签是（ ）。",
            "选项": [
                "A、 <html>",
                "B、 <head>",
                "C、 <title>",
                "D、 <body>"
            ],
            "答案": [3]
        },
        {
            "题号": 3,
            "题型": "单选",
            "分值": 2,
            "题目": "SQL Server 是基于（ ）的。",
            "选项": [
                "A、 关系型",
                "B、 文件系统",
                "C、 层次型",
                "D、 网络型"
            ],
            "答案": [0]
        },
        {
            "题号": 4,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项） C# 中，以下哪些是 C# 的循环语句（ ）。",
            "选项": [
                "A、 for",
                "B、 While",
                "C、 Switch",
                "D、 Do-while"
            ],
            "答案": [0,1,3]
        },
        {
            "题号": 5,
            "题型": "单选",
            "分值": 2,
            "题目": "C# 语言使用（ ）来引入名称空间。",
            "选项": [
                "A、 import",
                "B、 using",
                "C、 include",
                "D、 lib"
            ],
            "答案": [1]
        },
        {
            "题号": 6,
            "题型": "单选",
            "分值": 2,
            "题目": "通过 SQL，你如何从\"StudentInfo\" 表中选取\"stuName 列\"（ ）。",
            "选项": [
                "A、 SELECT StudentInfo.stuName",
                "B、 SELECT stuName FROM StudentInfo",
                "C、 EXTRACT stuName FROM StudentInfo",
                "D、 SELECT stuName from ScoreInfo"
            ],
            "答案": [1]
        },
        {
            "题号": 7,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 通过 SQL, 你如何从\"ScoreInfo\" 表中选取分数字段 Score 在 60-80 的所有信息（ ）。",
            "选项": [
                "A、 SELECT * FROM ScoreInfo WHERE Score >= 60 and Score <= 80",
                "B、 SELECT * FROM ScoreInfo WHERE Score >= 60 and <= 80",
                "C、 SELECT * FROM ScoreInfo WHERE Score between(60,80)",
                "D、 SELECT * FROM ScoreInfo WHERE Score between 60 and 80"
            ],
            "答案": [0,3]
        },
        {
            "题号": 8,
            "题型": "单选",
            "分值": 2,
            "题目": "在 C# 中，下面哪个关键字是导入命名空间（ ）？",
            "选项": [
                "A、 using",
                "B、 public",
                "C、 enum",
                "D、 namespace"
            ],
            "答案": [0]
        },
        {
            "题号": 9,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项） C# 中，以下哪些是 C# 的基本数据类型（ ）。",
            "选项": [
                "A、 int",
                "B、 string",
                "C、 float",
                "D、 object"
            ],
            "答案": [0,1,2]
        },
        {
            "题号": 10,
            "题型": "单选",
            "分值": 2,
            "题目": "类的以下特性中，可以用于方便地重用已有的代码和数据的是（ ）。",
            "选项": [
                "A、 多态",
                "B、 封装",
                "C、 继承",
                "D、 抽象"
            ],
            "答案": [2]
        },
        {
            "题号": 11,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 下列属于逻辑运算符的是（ ）。",
            "选项": [
                "A、 &&",
                "B、 +",
                "C、 %",
                "D、 ||"
            ],
            "答案": [0,3]
        },
        {
            "题号": 12,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 在 C# 中，下列表达式计算正确的是（ ）。",
            "选项": [
                "A、 10%3=3",
                "B、 10/3=3（注：整数除法结果取整）",
                "C、 10%3=1（余数计算正确）",
                "D、 10/3=1"
            ],
            "答案": [1,2]
        },
        {
            "题号": 13,
            "题型": "单选",
            "分值": 2,
            "题目": "下面代码的执行结果是（ ）？\npublic static void Main(string[] args)\n{\nint i = 2000;\nobject o = i; i = 2001;\nint j = (int)o;\nConsole.WriteLine(\"i={0},o={1},j={2}\", i, o, j);\n}",
            "选项": [
                "A、 i=2001,o=2000,j=2000",
                "B、 i=2001,o=2001,j=2001",
                "C、 i=2000,o=2001,j=2000",
                "D、 i=2001,o=2000,j=2001"
            ],
            "答案": [0]
        },
        {
            "题号": 14,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项） 以下哪些分层属于三层架构中的划分（ ）？",
            "选项": [
                "A、 表现层",
                "B、 业务逻辑层",
                "C、 领域模型层",
                "D、 数据访问层"
            ],
            "答案": [0,1,3]
        },
        {
            "题号": 15,
            "题型": "单选",
            "分值": 2,
            "题目": "WinForms 程序中，如果复选框控件的 Checked 属性值设置为 True，表示（ ）。",
            "选项": [
                "A、 该复选框被选中",
                "B、 该复选框不被选中",
                "C、 不显示该复选框的文本信息",
                "D、 显示该复选框的文本信息"
            ],
            "答案": [0]
        },
        {
            "题号": 16,
            "题型": "单选",
            "分值": 2,
            "题目": "下面选项中，可以设置页面中某个 DIV 标签相对页面水平居中的 CSS 样式是（ ）？",
            "选项": [
                "A、 margin:0 auto;",
                "B、 padding:0 auto;",
                "C、 text-align:center;",
                "D、 vertical-align:middle"
            ],
            "答案": [0]
        },
        {
            "题号": 17,
            "题型": "单选",
            "分值": 2,
            "题目": "在 C# WinForms 程序中，实现窗体间的跳转，创建窗体对象后显示窗体的方法为（ ）。",
            "选项": [
                "A、 Load",
                "B、 Show",
                "C、 Run",
                "D、 Exit"
            ],
            "答案": [1]
        },
        {
            "题号": 18,
            "题型": "单选",
            "分值": 2,
            "题目": "以下哪个关键字用于定义一个抽象类（ ）。",
            "选项": [
                "A、 abstract",
                "B、 virtual",
                "C、 sealed",
                "D、 override"
            ],
            "答案": [0]
        },
        {
            "题号": 19,
            "题型": "单选",
            "分值": 2,
            "题目": ".NET 框架是.NET 战略的基础，是一种新的便携的开发平台，它具有两个主要的组件，分别是（ ）和类库。",
            "选项": [
                "A、 公共语言运行库",
                "B、 Web 服务",
                "C、 命名空间",
                "D、 Main () 函数"
            ],
            "答案": [0]
        },
        {
            "题号": 20,
            "题型": "单选",
            "分值": 2,
            "题目": "下列哪个类型的对象是ADO.NET在非连接模式下处理数据内容的主要对象（ ）。",
            "选项": [
                "A、 Command",
                "B、 Connection",
                "C、 DataAdapter",
                "D、 DataSet"
            ],
            "答案": [3]
        },
        {
            "题号": 21,
            "题型": "单选",
            "分值": 2,
            "题目": "SQL Server 删除数据库中的表的命令是（ ）。",
            "选项": [
                "A、 delete table",
                "B、 delete from table",
                "C、 drop table",
                "D、 drop from table"
            ],
            "答案": [2]
        },
        {
            "题号": 22,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 成绩表 grade 中字段 score 代表分数，以下（ ）语句返回成绩表中的最低分。",
            "选项": [
                "A、 select max(score) from grade",
                "B、 select top 1 score from grade order by score asc",
                "C、 Select min(score) from grade",
                "D、 select top 1 score from grade order by score desc"
            ],
            "答案": [1,2]
        },
        {
            "题号": 23,
            "题型": "多选",
            "分值": 3,
            "题目": "（选三项） 在三层架构中，下面哪三层代码是必须的（ ）。",
            "选项": [
                "A、 BLL（业务逻辑层）",
                "B、 DAL（数据访问层）",
                "C、 Model（模型层）",
                "D、 UI（表现层）"
            ],
            "答案": [0,1,3]
        },
        {
            "题号": 24,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 要将页面的背景色设置为红色，下面语句正确的是（ ）。",
            "选项": [
                "A、 <BODY BGCOLOR=\"RED\"></BODY>",
                "B、 <BODY BGCOLOR=\"#FF0000\"></BODY>",
                "C、 <BODY BGCOLOR=\"#FFOOOO\"></BODY>",
                "D、 <BODY BGCOLOR=\"rgb(255, 0, 0)\"></BODY>"
            ],
            "答案": [0,1]
        }
    ],
    "试卷04": [
        {
            "题号": 1,
            "题型": "单选",
            "分值": 2,
            "题目": "超链接 a:hover 表示 ( )。",
            "选项": [
                "B、 鼠标移动到链接上",
                "A、 未访问的链接",
                "C、 已访问的链接",
                "D、 选定的链接"
            ],
            "答案": [0]
        },
        {
            "题号": 2,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 为了给页面所有<H1>标题创建样式规则，制定将所有的<H1>标题显示为蓝色，字体为 Arial，下面操作正确的是（ ）。",
            "选项": [
                "C、 <style type=\"text/css\">H1{color:blue;font-family:Arail}</style>",
                "A、 <style type=\"text/css\">H1{color:blue\" }H1{font-family:Arial}</style>",
                "B、 <style type=\"text/css\">H1{color:blue;font:Arail}</style>",
                "D、 <style type=\"text/css\">H1{color:blue}H1{fontface:Arail}</style>"
            ],
            "答案": [0, 1]
        },
        {
            "题号": 3,
            "题型": "单选",
            "分值": 2,
            "题目": "要想使 DIV 一列固定宽度并居中，应该设置 CSS 的哪个属性（ ）。",
            "选项": [
                "C、 margin：auto",
                "A、 border：center",
                "B、 width：center",
                "D、 以上都不对"
            ],
            "答案": [0]
        },
        {
            "题号": 4,
            "题型": "单选",
            "分值": 2,
            "题目": "在 HTML 中，要创建一个表单（form1），要向服务器发送数据的方式为 post，提交表单服务器的地址为 process.asp。下面创建表单正确的代码是（ ）。",
            "选项": [
                "A、 <form name=\"form1\" method=\"post\" action=\"process.asp\"></form>",
                "B、 <form name=\"form1\" method=\"post\" submit=\"process.asp\"><form>",
                "C、 <form name=\"form1\" method=\"post\" submitSrc=\"process.asp\"><form>",
                "D、 <form name=\"form1\" method=\"post\" src=\"process.asp\"><form>"
            ],
            "答案": [0]
        },
        {
            "题号": 5,
            "题型": "单选",
            "分值": 2,
            "题目": "要想使列表高度自适应，应该在 CSS 里添加下列哪个属性（ ）。",
            "选项": [
                "D、 overflow",
                "A、 Margin",
                "B、 float",
                "C、 display"
            ],
            "答案": [0]
        },
        {
            "题号": 6,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 在 HTML 中，input 元素的 type 属性用户制定表单元素的类型，下列不可用的类型有（ ）。",
            "选项": [
                "B、 textarea",
                "C、 select",
                "A、 image",
                "D、 hidden"
            ],
            "答案": [0, 1]
        },
        {
            "题号": 7,
            "题型": "单选",
            "分值": 2,
            "题目": "查找 authors 表中的所有电话号码的首位为 4, 第二位为 0 或 1 的电话号码（ ）。",
            "选项": [
                "A、 select phone from authors where phone like '4[1,0]%'",
                "B、 select phone from authors where phone in '4[^10]%'",
                "C、 select phone from authors where phone like '4_[1,0]%'",
                "D、 select phone from authors where phone between '41%' and '40%'"
            ],
            "答案": [0]
        },
        {
            "题号": 8,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 关于分组查询，以下 ( ) 描述是错误的。",
            "选项": [
                "A、 使用 group by 进行分组查询",
                "B、 对分组后的结果进行条件查询必须使用 Having 子句",
                "C、 Having 子句不能与 where 子句同时出现在一个 select 语句中",
                "D、 在使用分组查询时，在 select 列表中只能出现被分组的字段"
            ],
            "答案": [2, 3]
        },
        {
            "题号": 9,
            "题型": "单选",
            "分值": 2,
            "题目": "使用 SQL 创建多表查询要求查询中所涉及的表必须有（ ）。",
            "选项": [
                "B、 公共字段",
                "A、 主键",
                "C、 组合键",
                "D、 以上都不是"
            ],
            "答案": [0]
        },
        {
            "题号": 10,
            "题型": "单选",
            "分值": 2,
            "题目": "在查询分析器中执行以下的语句 Select top 40 percent sName,sAddress from students。结果返回 10 行数据，则（ ）。",
            "选项": [
                "B、 表 students 中只有 25 行数据",
                "A、 表 students 中只有 10 行数据",
                "C、 表 students 中只有 40 行数据",
                "D、 表 students 中只有 50 行数据"
            ],
            "答案": [0]
        },
        {
            "题号": 11,
            "题型": "单选",
            "分值": 2,
            "题目": "有一个 \"出版物\" 表，包含图书编码 (BOOK-CODE), 书名 (BOOK-NAME), 出版日期 (ISSUE-DT), 备注 (MEM-CD) 等字段，字段 ( ) 作为该表的主键可能是最恰当的。",
            "选项": [
                "A、 BOOK-CODE",
                "B、 BOOK-NAME",
                "C、 MEM-CD",
                "D、 BOOK-ID"
            ],
            "答案": [0]
        },
        {
            "题号": 12,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 关于数据完整性，以下说法正确的是（ ）。",
            "选项": [
                "A、 引用完整性通过主键和外键之间的引用关系实现",
                "B、 引用完整性通过限制数据类型、检查约束等实现",
                "C、 数据完整性是通过数据操纵者自身对数据的控制来实现的",
                "D、 如果两个表中存储的信息相互关联，那么只要修改了一个表，另外一个表也要做出相应的修改，则称该这两个表中的数据具备引用完整性"
            ],
            "答案": [0, 3]
        },
        {
            "题号": 13,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 在 WinForm 中，控件的显示和隐藏可以使用（ ）。",
            "选项": [
                "A、 Visible",
                "D、 Hide()",
                "B、 ReadOnly",
                "C、 Text"
            ],
            "答案": [0, 1]
        },
        {
            "题号": 14,
            "题型": "单选",
            "分值": 2,
            "题目": "在．Net 中，定时器（Timer）控件的（ ）事件用编写定时触发的程序代码。",
            "选项": [
                "D、 Tick",
                "A、 Timer",
                "B、 Start",
                "C、 Trigger"
            ],
            "答案": [0]
        },
        {
            "题号": 15,
            "题型": "单选",
            "分值": 2,
            "题目": "在后台里面如何获取文本框的值，通过（ ）属性。",
            "选项": [
                "A、 Text",
                "B、 Name",
                "C、 PasswordChar",
                "D、 以上都不是"
            ],
            "答案": [0]
        },
        {
            "题号": 16,
            "题型": "单选",
            "分值": 2,
            "题目": "清空文本框的内容使用（ ）方法。",
            "选项": [
                "C、 Clear()",
                "A、 Hide()",
                "B、 Show()",
                "D、 AppendText()"
            ],
            "答案": [0]
        },
        {
            "题号": 17,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） C# 中关于抽象类下面说法错误的是（ ）。",
            "选项": [
                "A、 抽象类可以包含非抽象方法",
                "B、 含有抽象方法的类一定是抽象类",
                "C、 抽象类能被实例化",
                "D、 抽象类可以是密封类"
            ],
            "答案": [2, 3]
        },
        {
            "题号": 18,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 在ADO.NET中，下列关于 DataSet 类说法有误的是（ ）。",
            "选项": [
                "A、 可以向 DataSet 的表集合中添加新表",
                "B、 DataSet 中的数据发生改变之后，它会自动更新数据库中对应的数据",
                "C、 DataSet 就好象是内存中的一个 \"临时数据库\"",
                "D、 DataSet 中的数据是只读的并且是只进的"
            ],
            "答案": [1, 3]
        },
        {
            "题号": 19,
            "题型": "单选",
            "分值": 2,
            "题目": "在 WinForm 中，用户单击消息框按钮时返回（ ）值。",
            "选项": [
                "B、 DialogResult 枚举值",
                "A、 DialogValue",
                "C、 DialogCommand",
                "D、 DialogBox"
            ],
            "答案": [0]
        },
        {
            "题号": 20,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） .NET Framework 有哪两个主要组件（ ）。",
            "选项": [
                "A、 公共语言运行时（CLR）",
                "B、 .NET Framework 类库集（FCL）",
                "C、 CLR 的 CTS（通用类型系统）",
                "D、 CLS（公共语言规范）"
            ],
            "答案": [0, 1]
        },
        {
            "题号": 21,
            "题型": "多选",
            "分值": 3,
            "题目": "（选两项） 在 C# 中，下列常量定义正确的是（ ）。",
            "选项": [
                "A、 const double PI=3.14;",
                "B、 const double e=2.7",
                "C、 define double PI=3.14",
                "D、 define double e=2.7"
            ],
            "答案": [0, 1]
        },
        {
            "题号": 22,
            "题型": "单选",
            "分值": 2,
            "题目": "C# 中，下面哪个循环结构是先执行后循环（ ）？",
            "选项": [
                "C、 do…while",
                "A、 for",
                "B、 while",
                "D、 foreach"
            ],
            "答案": [0]
        },
        {
            "题号": 23,
            "题型": "单选",
            "分值": 2,
            "题目": "在 C# 中，定义静态方法需要使用（ ）关键字。",
            "选项": [
                "D、 static",
                "A、 public",
                "B、 override",
                "C、 class"
            ],
            "答案": [0]
        },
        {
            "题号": 24,
            "题型": "单选",
            "分值": 2,
            "题目": "关于 C#, 以下说法正确的是（ ）。",
            "选项": [
                "B、 虚方法可以在派生类中重写，抽象方法必须重写",
                "A、 虚方法必须在派生类中重写，抽象方法不需要重写",
                "C、 虚方法必须在派生类中重写，抽象方法必须重写",
                "D、 虚方法可以在派生类中重写，抽象方法不需要重写"
            ],
            "答案": [0]
        }
    ],
    "试卷05": [
        {
            "题号": 1, "题型": "单选", "分值": 2,
            "题目": "SQL Server 数据库中，进行查询所使用的语言为 ( )。",
            "选项": ["B、 T-SQL", "A、 SQL", "C、 PL/SQL", "D、 SQL CMD"],
            "答案": [0]
        },
        {
            "题号": 2, "题型": "多选", "分值": 3,
            "题目": "（选两项） 关于分组查询，以下（ ）描述是错误的。",
            "选项": ["A、 使用 group by 进行分组查询", "B、 对分组后的结果进行条件查询必须使用 Having 子句", "C、 Having 子句不能与 where 子句同时出现在一个 select 语句中", "D、 在使用分组查询时，在 select 列表中只能出现被分组的字段"],
            "答案": [2, 3]
        },
        {
            "题号": 3, "题型": "多选", "分值": 3,
            "题目": "（选两项） 关于数据完整性，以下说法正确的是 ( )。",
            "选项": ["A、 引用完整性通过主键和外键之间的引用关系实现", "B、 引用完整性通过限制数据类型、检查约束等实现", "C、 数据完整性是通过数据操纵者自身对数据的控制来实现的", "D、 如果两个表中存储的信息相互关联，那么只要修改了一个表，另外一个表也要做出相应的修改，则称该这两个表中的数据具备引用完整性"],
            "答案": [0, 3]
        },
        {
            "题号": 4, "题型": "多选", "分值": 3,
            "题目": "（选两项） 在 SQL Server2012 建数据库必须要哪两类文件（ ）。",
            "选项": ["A、主要数据文件", "B、次要数据文件", "C、日志文件", "D、备份文件"],
            "答案": [0, 2]
        },
        {
            "题号": 5, "题型": "多选", "分值": 3,
            "题目": "（选两项） 成绩表 grade 中字段 score 代表分数，以下 ( ) 语句返回成绩表中的最低分。",
            "选项": ["A、select max(score) from grade", "B、select top 1 score from grade order by score asc", "C、Select min(score) from grade", "D、select top 1 score from grade order by score desc"],
            "答案": [1, 2]
        },
        {
            "题号": 6, "题型": "单选", "分值": 2,
            "题目": "在 C# 中下列关于构造函数的描述正确的是 ( )？",
            "选项": ["C、 构造函数必须与类同名", "A、构造函数可以声明返回类型", "B、构造函数不可以用 private 修饰", "D、构造函数不能带参数"],
            "答案": [0]
        },
        {
            "题号": 7, "题型": "单选", "分值": 2,
            "题目": "在 C# 中定义一个数组，正确的代码为 ( )。",
            "选项": ["B、 int[] arraya = new int[5];", "A、int arraya = new int[5];", "C、int arraya = new int[];", "D、int[5] arraya = new int;"],
            "答案": [0]
        },
        {
            "题号": 8, "题型": "多选", "分值": 3,
            "题目": "（选两项） 以下关于 C# 中方法重载的说法正确的是（ ）。",
            "选项": ["A、 如两个方法名字不同，而参数的数量不同，那么它们可以构成方法重载", "B、 如两个方法名字相同，而返回值的数据类型不同，那么它们可以构成方法重载", "C、 如两个方法名字相同，而参数的数据类型不同，那么它们可以构成方法重载", "D、 如两个方法名字相同，而参数的数量不同，那么它们可以构成方法重载"],
            "答案": [2, 3]
        },
        {
            "题号": 9, "题型": "多选", "分值": 3,
            "题目": "（选两项） 以下叙述正确的是 ( )。",
            "选项": ["A、 接口中可以有虚方法", "B、 一个类可以实现多个接口", "C、 接口中可以包含已实现的方法", "D、 接口不能被实例化"],
            "答案": [1, 3]
        },
        {
            "题号": 10, "题型": "多选", "分值": 3,
            "题目": "（选两项） 类用来描述具有相同特征和行为的对象，它包含（ ）。",
            "选项": ["A、 变量", "B、 方法", "C、 构造方法", "D、 行为"],
            "答案": [0, 1]
        },
        {
            "题号": 11, "题型": "单选", "分值": 2,
            "题目": "在 C# 程序中，使用 try...catch... ( ) 结构来处理异常。",
            "选项": ["C、 finally", "A、error", "B、process", "D、do"],
            "答案": [0]
        },
        {
            "题号": 12, "题型": "单选", "分值": 2,
            "题目": "C# 语言使用（ ）来引入名称空间。",
            "选项": ["B、 using", "A、import", "C、include", "D、lib"],
            "答案": [0]
        },
        {
            "题号": 13, "题型": "多选", "分值": 3,
            "题目": "（选两项） 关于 C# 语言的基本语法，下列哪些说法是正确的（ ）。",
            "选项": ["A、 C# 语言使用 using 关键字来引用.NET 预定义的名字空间", "B、 用 C# 编写的程序中，Main 函数是唯一允许的全局函数", "C、 C# 语言中使用的名称严格区分大小写", "D、 C# 中一条语句必须写在一行内"],
            "答案": [0, 2]
        },
        {
            "题号": 14, "题型": "单选", "分值": 2,
            "题目": "在使用ADO.NET编写连接到 SQL Server 2005 数据库的应用程序时，从提高性能的角度考虑，应创建（ ）类的对象，并调用其 Open 方法连接到数据库。",
            "选项": ["B、 SqlConnection", "A、 OleDbConnection", "C、 OdbcConnection", "D、 Connection"],
            "答案": [0]
        },
        {
            "题号": 15, "题型": "单选", "分值": 2,
            "题目": "ADO.NET的（ ）对象用来建立应用程序与数据库的连接。",
            "选项": ["A、 DataAdapter", "B、 DataSet", "C、 DataTable", "D、 DataReader"],
            "答案": [0]
        },
        {
            "题号": 16, "题型": "单选", "分值": 2,
            "题目": "在ADO.NET中，SqlConnection 类所在的命名空间是（ ）。",
            "选项": ["D、 System.Data.SqlClient", "A、 System", "B、 System.Data", "C、 System.Data.OleDb"],
            "答案": [0]
        },
        {
            "题号": 17, "题型": "单选", "分值": 2,
            "题目": "三层架构中不包含的层是（ ）。",
            "选项": ["D、 模型层", "A、 表现层", "B、 业务逻辑层", "C、 数据访问层"],
            "答案": [0]
        },
        {
            "题号": 18, "题型": "单选", "分值": 2,
            "题目": "在三层架构中实体类的作用是（ ）。",
            "选项": ["B、 数据传递的载体", "A、 访问数据库", "C、 显示数据，提供界面", "D、 数据保存和读取"],
            "答案": [0]
        },
        {
            "题号": 19, "题型": "单选", "分值": 2,
            "题目": "在 ADO.NET 中，为访问 DataTable 对象从数据源提取的数据行。可使用 DataTable 对象的（ ）属性。",
            "选项": ["A、 Rows", "B、 Columns", "C、 Constraints", "D、 DataSet"],
            "答案": [0]
        },
        {
            "题号": 20, "题型": "单选", "分值": 2,
            "题目": "WinForms 程序的入口点为（ ）。",
            "选项": ["A、静态方法 Main", "B、静态方法 Start", "C、启动窗体的 Form_Load 事件", "D、Appliaction_OnStart 事件"],
            "答案": [0]
        },
        {
            "题号": 21, "题型": "多选", "分值": 3,
            "题目": "（选两项） （ ）控件可以将其他控件分组。",
            "选项": ["A、 GroupBox", "B、 ComboBox", "C、 Panel", "D、 TextBox"],
            "答案": [0, 2]
        },
        {
            "题号": 22, "题型": "单选", "分值": 2,
            "题目": "在.NET 的 WinForms 程序中，可以使用 ( ) 对象来连接和访问数据库？",
            "选项": ["C、 ADO.NET", "A、MDI", "B、JIT", "D、System.ADO"],
            "答案": [0]
        },
        {
            "题号": 23, "题型": "单选", "分值": 2,
            "题目": "WinForms 程序中，如果复选框控件的 Checked 属性值设置为 False，则表示（ ）。",
            "选项": ["B、 该复选框不被选中", "A、 该复选框被选中", "C、 不显示该复选框的文本信息", "D、 显示该复选框的文本信息"],
            "答案": [0]
        },
        {
            "题号": 24, "题型": "单选", "分值": 2,
            "题目": "在 WinForms 中，已知有一个名为 Form1 的窗体，请问下列代码执行过程中，最先触发的事件是（ ）？",
            "选项": ["A、Load", "B、Activated", "C、Closing", "D、Closed"],
            "答案": [0]
        }
    ],
    "试卷06": [
        {
            "题号": 1, "题型": "单选", "分值": 2,
            "题目": "合并单元格 3 列为 1 列，下面设置正确的是（ ）？",
            "选项": ["A、 <td colspan='3'></td>", "B、 <td rowspan='3'></td>", "C、 <td cols='3'></td>", "D、 <td rows='3'></td>"],
            "答案": [0]
        },
        {
            "题号": 2, "题型": "多选", "分值": 3,
            "题目": "（选两项） 无序列表和有序列表的标签名分别是（ ）？",
            "选项": ["A、 ul", "B、 li", "C、 ol", "D、 nl"],
            "答案": [0, 2]
        },
        {
            "题号": 3, "题型": "多选", "分值": 3,
            "题目": "（选两项） SQL 语句：select * from students where SNO like '010 [^0]%[A,B,C]%', 可能会查询出的 SNO 是（ ）。",
            "选项": ["A、 01053090A（第三位非 0，后续含 A）", "B、 01003090A01（第三位为 0，不满足 [^0]）", "C、 01053090D09（后续字符非 A/B/C）", "D、 0101A01（第三位为 1，满足 [^0]，含 A）"],
            "答案": [0, 3]
        },
        {
            "题号": 4, "题型": "单选", "分值": 2,
            "题目": "引用完整性约束是用来维护（ ）个表之间的行的一致性的？",
            "选项": ["A、 二（通过主键与外键关联两张表）", "B、 三", "C、 多个", "D、 至少三"],
            "答案": [0]
        },
        {
            "题号": 5, "题型": "多选", "分值": 3,
            "题目": "（选两项） 在 SQL Server2005 建数据库必须要哪两类文件（ ）？",
            "选项": ["A、 主要数据文件（.mdf）", "B、 次要数据文件（.ndf，可选）", "C、 备份文件", "D、 日志文件（.ldf）"],
            "答案": [0, 3]
        },
        {
            "题号": 6, "题型": "多选", "分值": 3,
            "题目": "（选两项） 关于分组查询，以下（ ）描述是错误的 。",
            "选项": ["A、 使用 group by 进行分组查询", "B、 对分组后的结果进行条件查询必须使用 Having 子句", "C、 Having 子句不能与 where 子句同时出现在一个 select 语句中（可以同时使用，先 WHERE 过滤再 HAVING 分组后过滤）", "D、 在使用分组查询时，在 select 列表中只能出现被分组的字段（可包含聚合函数）"],
            "答案": [2, 3]
        },
        {
            "题号": 7, "题型": "多选", "分值": 3,
            "题目": "（选两项） 在 SQL Server 2005 中，列出所有已选课学生的学号、姓名、课程编号和成绩的 SQL 语句是（ ）。",
            "选项": ["A、 SELECT sID,sName,cId,score FROM student,studentCourse（未加关联条件，错误）", "B、 SELECT sID,sName,cID,score FROM student INNER JOIN studentCourse ON student.sID = studentCourse.sID（内连接）", "C、 SELECT sID,sName,cID,score FROM student OUTER JOIN studentCourse ON student.sID = studentCourse.sID（外连接会包含未选课学生，不符合 \"已选课\" 要求）", "D、 SELECT sID,sName,cID,score FROM student, studentCourse WHERE student.sID = studentCourse.sID（逗号连接 + WHERE 条件等效于内连接）"],
            "答案": [1, 3]
        },
        {
            "题号": 8, "题型": "单选", "分值": 2,
            "题目": "关于接口的使用，说法错误的是（ ）。",
            "选项": ["A、 接口可以作为参数进行传递", "B、 接口可以作为方法的返回值", "C、 接口可以实例化（接口是抽象的，不能实例化）", "D、 同时实现多个接口是变相实现了多重继承"],
            "答案": [2]
        },
        {
            "题号": 9, "题型": "多选", "分值": 3,
            "题目": "（选两项） 以下关于 C# 中方法重载的说法正确的是（ ）。",
            "选项": ["A、 如两个方法名字不同，而参数的数量不同，那么它们可以构成方法重载（方法名必须相同）", "B、 如两个方法名字相同，而返回值的数据类型不同，那么它们可以构成方法重载（返回值不影响重载）", "C、 如两个方法名字相同，而参数的数据类型不同，那么它们可以构成方法重载", "D、 如两个方法名字相同，而参数的数量不同，那么它们可以构成方法重载"],
            "答案": [2, 3]
        },
        {
            "题号": 10, "题型": "多选", "分值": 3,
            "题目": "（选两项） 类用来描述具有相同特征和行为的对象，它包含（ ）。",
            "选项": ["A、 变量（字段）", "B、 方法", "C、 构造方法（属于特殊方法，包含在 B 中）", "D、 行为（抽象描述，非具体成员）"],
            "答案": [0, 1]
        },
        {
            "题号": 11, "题型": "多选", "分值": 3,
            "题目": "（选两项） 下列对 System.String 类的描述正确的两项是（ ）。",
            "选项": ["A、 该类对象的内容可以改变（String 是不可变类型，内容不可变）", "B、 该类对象的内容不能改变", "C、 该类的引用变量可以指向其它的同类型对象（引用可重新赋值）", "D、 该类的引用变量不能指向其它的同类型对象"],
            "答案": [1, 2]
        },
        {
            "题号": 12, "题型": "单选", "分值": 2,
            "题目": "下列关于 try…catch…finally 语句的说明中，不正确的是（ ）。",
            "选项": ["A、 catch 块可以有多个", "B、 finally 块是可选的", "C、 可以只有 try 块（try 块必须伴随 catch 或 finally，不能单独存在）", "D、 catch 块也是可选的（可只有 try+finally）"],
            "答案": [2]
        },
        {
            "题号": 13, "题型": "单选", "分值": 2,
            "题目": "while 语句循环结构和 do…while 语句循环结构的区别在于（ ）。",
            "选项": ["A、 while 语句的执行效率较高", "B、 do…while 语句编写程序较复杂", "C、 无论条件是否成立，while 语句都要执行一次循环体", "D、 do…while 循环是先执行循环体，后判断条件表达式是否成立，而 while 语句是先判断条件表达式，再决定是否执行循环体"],
            "答案": [3]
        },
        {
            "题号": 14, "题型": "单选", "分值": 2,
            "题目": ".NET 构架中被用来访问数据库数据的组件集合称为（ ）。",
            "选项": ["A、 ADO", "B、 ADO.NET", "C、 COM", "D、 Data Service.NET"],
            "答案": [1]
        },
        {
            "题号": 15, "题型": "单选", "分值": 2,
            "题目": "在ADO.NET中，SqlConnection 类所在的命名空间是（ ）。",
            "选项": ["A、 System", "B、 System.Data", "C、 System.Data.OleDb", "D、 System.Data.SqlClient"],
            "答案": [3]
        },
        {
            "题号": 16, "题型": "单选", "分值": 2,
            "题目": "三层结构中数据传递方向正确的是（ ）。",
            "选项": ["A、 表现层请求业务逻辑层（表现层→业务逻辑层→数据访问层）", "B、 表现层请求数据访问层", "C、 业务逻辑层请求表现层", "D、 数据访问层请求表现层"],
            "答案": [0]
        },
        {
            "题号": 17, "题型": "单选", "分值": 2,
            "题目": "关于表现层的说法正确的是（ ）。",
            "选项": ["A、 在表示层需要实例化业务逻辑层类对象（表现层调用业务逻辑层）", "B、 在表示层需要实例化数据访问层对象", "C、 为服务器提供操作界面（表现层是用户界面，非服务器）", "D、 为服务器提供数据"],
            "答案": [0]
        },
        {
            "题号": 18, "题型": "单选", "分值": 2,
            "题目": "三层架构中使用（ ）作为数据传递的载体 。",
            "选项": ["A、 DataSet（数据集，用于数据存储）", "B、 DataTable（数据表）", "C、 DataView（数据视图）", "D、 DataReader（数据读取器，只读）"],
            "答案": [0]
        },
        {
            "题号": 19, "题型": "单选", "分值": 2,
            "题目": "下列（ ）是 ADO．NET 的两个主要组件。",
            "选项": ["A、 Command 和 DataAdapter（属于数据提供程序）", "B、 DataSet 和 DataAdapter", "C、 NET Framework 数据提供程序和 DataSet（ADO.NET由数据提供程序和 DataSet 组成）", "D、 NET Framework 数据提供程序和 DataAdapter"],
            "答案": [2]
        },
        {
            "题号": 20, "题型": "单选", "分值": 2,
            "题目": "WinForm 程序中，如果复选框控件的 Checked 属性值设置为 False，则表示（ ）。",
            "选项": ["A、 该复选框被选中", "B、 该复选框不被选中", "C、 不显示该复选框的文本信息", "D、 显示该复选框的文本信息"],
            "答案": [1]
        },
        {
            "题号": 21, "题型": "单选", "分值": 2,
            "题目": "下列对 DataGridView 控件的常见用途说法不正确的是（ ）。",
            "选项": ["A、 显示数据集中的单个数据表", "B、 显示多个表的数据", "C、 显示多个相关表的数据", "D、 只能显示单个表的数据（可显示多个相关表的数据，通过数据源绑定）"],
            "答案": [3]
        },
        {
            "题号": 22, "题型": "单选", "分值": 2,
            "题目": "在 WinForm 应用程序中，可以通过以下（ ）方法使一个窗体成为 MDI 窗体。",
            "选项": ["A、 改变窗体的标题信息", "B、 在工程的选项中设置启动窗体", "C、 设置窗体的 IsMdiContainer 属性（设置为 true）", "D、 设置窗体的 ImeMode 属性"],
            "答案": [2]
        },
        {
            "题号": 23, "题型": "多选", "分值": 3,
            "题目": "（选两项） （ ）控件可以将其他控件分组。",
            "选项": ["A、 GroupBox（带标题的分组框）", "B、 ComboBox（下拉框）", "C、 Panel（无标题的容器面板）", "D、 TextBox（文本框）"],
            "答案": [0, 2]
        },
        {
            "题号": 24, "题型": "单选", "分值": 2,
            "题目": "下面（ ）可以显示一个模式窗体。",
            "选项": ["A、 Application.Run (new Form1 ())（启动应用程序，显示主窗体）", "B、 form1.Show ()（显示非模式窗体）", "C、 form1.ShowDialog()（显示模式对话框，阻塞父窗体）", "D、 MessageBox.Show ()（显示消息框，非模式窗体）"],
            "答案": [2]
        }
    ]
};

        // 开始答题
        function startQuiz() {
            const paperName = this.dataset.paper;
            if (!paperName) return;
            
            quizStartTime = new Date(); // 记录开始时间
            if(timeEstimationInterval) clearInterval(timeEstimationInterval); // 清除旧的计时器
            timeEstimationInterval = setInterval(updateEstimatedCompletionTime, 1000); // 每1秒更新一次

            // 更新试卷状态
            document.querySelector(`.cell[data-paper="${paperName}"] .status`).textContent = "进行中";
            
            currentPaper = examPapers[paperName];
            document.getElementById('quiz-title').textContent = paperName;
            currentQuestionIndex = 0;
            
            // 检查是否有保存的状态
            const savedState = loadQuizState();
            if (savedState && savedState.paperName === paperName) {
                // 如果有保存的状态并且是同一份试卷，恢复答题状态
                currentScore = savedState.score;
                document.getElementById('score').textContent = `得分: ${currentScore}`;
                renderQuestions(true); // 传入true表示从保存状态恢复
            } else {
                // 如果没有保存状态或不是同一份试卷，清除旧状态
                clearQuizState();
                selectedAnswers.clear();
                questionsToReview.clear(); // 开始新试卷时清空待复查列表
            renderQuestions();
            }
            
            document.getElementById('submit').disabled = false;
            
            // 显示导航和进度条
            document.getElementById('progress-container').style.display = 'block';
            document.getElementById('prev-question').style.display = 'inline-block';
            document.getElementById('next-question').style.display = 'inline-block';
            
            updateProgressBar();
            renderQuestionNav();
            
            // 添加手势滑动切题功能
            setupSwipeNavigation();

            saveQuizState(paperName);
        }

        let touchStartX = 0;
        let touchEndX = 0;
        const SWIPE_THRESHOLD = 30; // 降低检测阈值
        const VERTICAL_TOLERANCE = 20; // 新增垂直容差
        let touchStartY = 0; //  新增：记录Y轴起始位置

        function handleTouchStart(event) {
            touchStartX = event.changedTouches[0].screenX;
            touchStartY = event.changedTouches[0].screenY; //  记录Y轴起始位置
            // touchEndX an initial value in case no touchmove occurs
            touchEndX = event.changedTouches[0].screenX; 
        }

        function handleTouchMove(event) {
            const deltaY = Math.abs(event.changedTouches[0].screenY - touchStartY);
            if (deltaY > VERTICAL_TOLERANCE) { // 垂直滑动时不处理
                // 可以选择重置 touchStartX 和 touchEndX，以防止后续误判为水平滑动
                // touchStartX = 0;
                // touchEndX = 0;
                return; 
            }
            // event.preventDefault(); // 可选：如果滑动区域也可能垂直滚动，需要更复杂的逻辑来判断是否阻止
            touchEndX = event.changedTouches[0].screenX;
        }

        function handleTouchEnd(event) {
            if (isAnimating) {
                // Reset touch tracking if animation is in progress to prevent stale data
                touchStartX = 0; touchEndX = 0; touchStartY = 0;
                return;
            } 

            // If the touchend originated on an option, let the click handler for the option manage navigation.
            // Do not interpret this as a swipe for question navigation.
            if (event.target.closest('.option')) {
                touchStartX = 0; touchEndX = 0; touchStartY = 0; // Reset for next independent swipe
                return;
            }

            const finalTouchEndX = event.changedTouches[0].screenX;
            const deltaX = finalTouchEndX - touchStartX;

            if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
                if (deltaX < 0) {
                    // 左滑 - 下一题
                    if (currentQuestionIndex < currentPaper.length - 1) {
                        const currentQ = currentPaper[currentQuestionIndex];
                        const isCurrentAnswered = selectedAnswers.has(currentQ.题号) && selectedAnswers.get(currentQ.题号).size > 0;
                        if (!isCurrentAnswered) {
                            alert("请先回答当前题目，再进入下一题。");
                            touchStartX = 0; // 重置以避免因alert卡顿导致的连续触发
                            touchEndX = 0;
                            return;
                        }
                        showQuestion(currentQuestionIndex + 1, 'next');
                    }
                } else {
                    // 右滑 - 上一题 (通常不限制)
                    if (currentQuestionIndex > 0) {
                        showQuestion(currentQuestionIndex - 1, 'prev');
                    }
                }
            }
            // 重置，以便下次滑动
            touchStartX = 0;
            touchEndX = 0;
        }

        function setupSwipeNavigation() {
            const questionsContainer = document.getElementById('questions-container');
            if (questionsContainer) {
                // 先移除旧的监听器，防止重复绑定 (如果 startQuiz 多次调用)
                questionsContainer.removeEventListener('touchstart', handleTouchStart, false);
                questionsContainer.removeEventListener('touchmove', handleTouchMove, false);
                questionsContainer.removeEventListener('touchend', handleTouchEnd, false);

                questionsContainer.addEventListener('touchstart', handleTouchStart, { passive: true }); // passive:true 提高滚动性能，如果不需要 preventDefault
                questionsContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
                questionsContainer.addEventListener('touchend', handleTouchEnd, false);
            }
        }

        // 更新进度条
        function updateProgressBar() {
            const answeredCount = selectedAnswers.size;
            const totalCount = currentPaper.length;
            const progress = (answeredCount / totalCount) * 100;
            document.getElementById('progress-bar').style.width = `${progress}%`;
        }

        // 渲染题目导航
        function renderQuestionNav() {
            const nav = document.getElementById('question-nav');
            nav.innerHTML = '';
            
            currentPaper.forEach((q, idx) => {
                const navItem = document.createElement('div');
                navItem.className = 'question-nav-item';
                navItem.onclick = () => showQuestion(idx, idx > currentQuestionIndex ? 'next' : 'prev');
                
                const tooltip = document.createElement('span');
                tooltip.className = 'tooltip';
                tooltip.textContent = `题型: ${q.题型}, 分值: ${q.分值}`;
                
                const contentSpan = document.createElement('span');
                const userAnswerSet = selectedAnswers.get(q.题号);

                // 重置可能由 .current 或 .answered 类残留的内联样式（如果之前有的话）
                navItem.style.background = '';
                navItem.style.borderColor = '';
                contentSpan.style.color = '';
                navItem.classList.remove('answered', 'current'); // 先移除旧状态类

                if (userAnswerSet && userAnswerSet.size > 0) { // 如果题目已作答
                    navItem.classList.add('answered'); // 应用 .answered 的样式 (背景和边框)
                    contentSpan.innerHTML = '✓'; // 显示通用已选标记
                    contentSpan.style.color = 'var(--primary-blue)'; // 设置标记颜色
                } else { // 如果题目未作答
                    contentSpan.innerHTML = q.题号.toString();
                    contentSpan.style.color = 'var(--text-color)'; // 题号使用默认文本颜色
                    navItem.style.borderColor = 'var(--border-color)'; // 默认边框颜色
                }
                
                if (idx === currentQuestionIndex) { // 如果是当前题目
                    navItem.classList.remove('answered'); // .current 优先级更高，移除 .answered
                    navItem.classList.add('current');    // 应用 .current 的样式
                    // .current 类应已包含 background, color (for contentSpan), borderColor
                    // 为确保，可以显式设置 contentSpan color
                    contentSpan.style.color = 'white'; 
                }
                
                navItem.innerHTML = ''; // 清空 navItem 以便重新构建
                navItem.appendChild(contentSpan);
                navItem.appendChild(tooltip); 

                // 处理待复习标记
                if (questionsToReview.has(q.题号)) {
                    navItem.classList.add('marked-for-review-nav');
                } else {
                    navItem.classList.remove('marked-for-review-nav');
                }
                
                nav.appendChild(navItem);
            });
        }

        // 显示指定题目
        let isAnimating = false; // 防止快速点击导致动画错乱
        function showQuestion(index, direction) { // direction: 'next' or 'prev'
            // 新增索引合法性检查
            index = Math.max(0, Math.min(index, currentPaper.length - 1));

            // 如果目标就是当前题目，或者正在动画中，或者索引无效，则不执行
            if (index === currentQuestionIndex || isAnimating || index < 0 || index >= currentPaper.length) {
                // 如果是因为动画中而阻止，可以考虑打印一个日志
                if (isAnimating) console.log("Animation in progress, showQuestion call ignored.");
                return;
            }

            // 新增连续性检查 (仅在direction明确时，因为初始加载可能直接跳到特定题目)
            // 此检查主要用于调试或防止意外的非用户直接操作的大幅度跳转
            if (direction && Math.abs(index - currentQuestionIndex) > 1) {
                 const isSmartJump = arguments.callee.caller && arguments.callee.caller.name === 'checkAndTriggerSmartJump';
                if (!isSmartJump) {
                    console.warn('异常跳转请求被拦截（非连续跳转）', currentQuestionIndex, '=>', index);
                    //  如果希望严格阻止这类跳转，可以取消下面 return 的注释
                    // return; 
                }
            }
            
            isAnimating = true; // 在所有检查通过后，实际开始切换前，设置动画状态

            if (navigator.vibrate && direction) {
                navigator.vibrate(10); // 进一步减少震动时长或根据动画调整
            }

            const questionsContainer = document.getElementById('questions-container');
            const questions = Array.from(questionsContainer.children); // 直接获取子元素
            const currentActiveQuestionVisual = questions[currentQuestionIndex];
            const nextActiveQuestionVisual = questions[index];

            if (currentActiveQuestionVisual) {
                currentActiveQuestionVisual.style.opacity = '0'; // 开始淡出现有题目
            }

            setTimeout(() => {
                if (currentActiveQuestionVisual) {
                    currentActiveQuestionVisual.classList.remove('active');
                    currentActiveQuestionVisual.style.display = 'none'; 
                    currentActiveQuestionVisual.style.opacity = ''; // 清除行内opacity，以便下次激活时class生效
                }

                if (nextActiveQuestionVisual) {
                    nextActiveQuestionVisual.style.opacity = ''; // 确保没有遗留的行内opacity干扰
                    nextActiveQuestionVisual.style.display = 'block'; 
                    void nextActiveQuestionVisual.offsetWidth; // 强制重绘以确保动画从opacity 0开始
                    nextActiveQuestionVisual.classList.add('active'); // 添加active类以触发淡入
                }
                
                currentQuestionIndex = index;
                renderQuestionNav(); // 更新导航圆圈的状态

                // 更新上一题/下一题按钮状态
                document.getElementById('prev-question').disabled = index === 0;
                
                const nextButton = document.getElementById('next-question');
                if (index === currentPaper.length - 1) {
                    nextButton.disabled = true; // 如果是最后一题，始终禁用下一题
                } else {
                    const currentQData = currentPaper[index];
                    const currentIsAnswered = selectedAnswers.has(currentQData.题号) && selectedAnswers.get(currentQData.题号).size > 0;
                    nextButton.disabled = !currentIsAnswered; // 如果未作答，禁用下一题
                }
                
                isAnimating = false;
            }, 180); // 与CSS动画时长一致
        }

        // 渲染题目
        function renderQuestions(fromSavedState = false) {
            const container = document.getElementById('questions-container');
            container.innerHTML = '';
            
            if (!fromSavedState) {
                selectedAnswers.clear();
                questionsToReview.clear(); // 开始新试卷时清空待复查列表
            }

            currentPaper.forEach((q, index) => {
                const questionDiv = document.createElement('div');
                questionDiv.className = 'question'; 
                questionDiv.dataset.type = q.题型;
                questionDiv.dataset.qid = q.题号; 

                if (questionsToReview.has(q.题号)) {
                    questionDiv.classList.add('marked-for-review');
                    addReviewIndicator(questionDiv, q.题号); 
                }

                if (index === currentQuestionIndex) { // 初始加载时，直接设置为 active
                    questionDiv.classList.add('active');
                    // .active 类会负责 opacity:1 和 display:block
                } else {
                    questionDiv.style.display = 'none'; // 只设置 display:none。opacity:0 由 .question 类控制
                    // 移除下面这行，因为它会导致行内样式 opacity:0 覆盖 .active 类的 opacity:1
                    // questionDiv.style.opacity = '0'; 
                }
        
                const escapedOptions = q.选项.map(opt => {
                    const temp = document.createElement('div');
                    temp.textContent = opt;
                    return temp.innerHTML;
                });
        
                questionDiv.innerHTML = `
                    <h3>${q.题号}. ${q.题目}（${q.分值}分）</h3>
                    <div class="options">
                        ${escapedOptions.map((opt, idx) => `
                            <div class="option${fromSavedState && selectedAnswers.get(q.题号)?.has(idx) ? ' selected' : ''}" data-qid="${q.题号}" data-opt="${idx}">
                                ${String.fromCharCode(65 + idx)}. ${opt}
                            </div>
                        `).join('')}
                    </div>
                `;
                container.appendChild(questionDiv);

                // 长按事件监听
                let touchMoveThresholdPassed = false;
                questionDiv.addEventListener('touchstart', (e) => {
                    touchMoveThresholdPassed = false;
                    clearTimeout(longPressTimer);
                    longPressTimer = setTimeout(() => {
                        if (!touchMoveThresholdPassed) {
                            handleLongPress(questionDiv, q.题号);
                        }
                    }, LONG_PRESS_DURATION);
                }, { passive: true });

                questionDiv.addEventListener('touchmove', () => {
                    touchMoveThresholdPassed = true;
                    clearTimeout(longPressTimer);
                }, { passive: true });

                questionDiv.addEventListener('touchend', () => {
                    clearTimeout(longPressTimer);
                });
                 questionDiv.addEventListener('contextmenu', (e) => { // 桌面右键模拟长按
                    e.preventDefault();
                    handleLongPress(questionDiv, q.题号);
                });

                // 双击题干放大
                const questionContentForZoom = questionDiv.querySelector('h3'); // 或者整个 questionDiv
                if (questionContentForZoom) {
                    questionContentForZoom.addEventListener('dblclick', function() {
                        this.classList.toggle('zoomed');
                        if (navigator.vibrate) {
                            navigator.vibrate(25);
                        }
                    });
                }
            });

            document.querySelectorAll('.option').forEach(opt => {
                opt.addEventListener('click', handleAnswer);
            });
            
            document.getElementById('prev-question').disabled = true;
            document.getElementById('next-question').disabled = currentPaper.length <= 1;
            
            // 初始调用 showQuestion 来正确设置第一个题目
            // showQuestion(0, null); // 或者在 renderQuestions 内部直接设置active
            if (currentPaper.length > 0) {
                 const firstQuestion = container.querySelector('.question.active'); 
                 if(firstQuestion) {
                    // 以下样式由 .active 类处理，无需在此处重复设置，除非要特别覆盖
                    // firstQuestion.style.opacity = '1';
                    // firstQuestion.style.display = 'block'; 
                    // firstQuestion.style.position = 'relative';
                 }
            }
        }

        // 处理答案选择
        function handleAnswer(event) {
            const option = event.currentTarget;
            const qid = parseInt(option.dataset.qid);
            const optIndex = parseInt(option.dataset.opt);
            const questionData = currentPaper.find(q => q.题号 === qid);

            // 保持原有的选中逻辑
            if (questionData.题型 === '单选') {
                // 如果点击的已经是当前选中的选项，则不执行任何操作
                if (option.classList.contains('selected')) {
                    console.log("Clicked already selected single-choice option. No action.");
                    return; 
                }

                // 移除同题目其他选项的 selected 类
                document.querySelectorAll(`.option[data-qid="${qid}"]`).forEach(opt => {
                    if (opt !== option) {
                        opt.classList.remove('selected');
                    }
                });
                selectedAnswers.set(qid, new Set([optIndex]));
                option.classList.add('selected'); // 标记当前选中的

                // 单选题选择后自动跳转到下一题 (如果不是最后一题)
                if (currentQuestionIndex < currentPaper.length - 1) {
                    setTimeout(() => {
                        // 在跳转前检查是否正在动画，避免快速点击导致问题
                        if (!isAnimating) {
                            showQuestion(currentQuestionIndex + 1, 'next');
                        }
                    }, 450); // 延迟后跳转
                }
            } else { // 多选题
                const currentSelections = selectedAnswers.get(qid) || new Set();
                if (currentSelections.has(optIndex)) {
                    currentSelections.delete(optIndex);
                    option.classList.remove('selected');
                } else {
                    currentSelections.add(optIndex);
                    option.classList.add('selected');
                }
                selectedAnswers.set(qid, currentSelections);
            }

            updateProgressBar();
            renderQuestionNav(); // 更新导航中题目的状态
            saveQuizState(); // 保存答题状态
            
            // 更新 Next 按钮状态，基于当前题目作答情况
            if (currentQuestionIndex < currentPaper.length - 1) {
                const currentQData = currentPaper[currentQuestionIndex];
                const currentIsAnswered = selectedAnswers.has(currentQData.题号) && selectedAnswers.get(currentQData.题号).size > 0;
                document.getElementById('next-question').disabled = !currentIsAnswered;
            } else {
                // 如果是最后一题，确保下一题按钮是禁用的
                document.getElementById('next-question').disabled = true;
            }

            // 提交按钮的启用逻辑保持不变 (所有题目都有答案才启用)
            const allAnswered = true;
    document.getElementById('submit').disabled = !allAnswered;

            // 尝试智能跳转
            checkAndTriggerSmartJump(qid);

            // 触觉反馈
            if (navigator.vibrate) {
                navigator.vibrate(30); // 减少震动时长
            }
            updateEstimatedCompletionTime(); // 答题后也立即更新一次
        }

        // 新增：检查并触发智能跳转
        function checkAndTriggerSmartJump(answeredQuestionId) {
            const questionData = currentPaper.find(q => q.题号 === answeredQuestionId);
            if (!questionData) return;

            const userAnswerSet = selectedAnswers.get(questionData.题号);
            if (!userAnswerSet || userAnswerSet.size === 0) {
                // 如果题目没有答案了（比如取消了所有选择），重置 streak
                if (lastCorrectlyAnsweredQId === answeredQuestionId) { // 确保是之前答对的那题
                    consecutiveCorrectStreak = 0;
                    lastCorrectlyAnsweredQId = null;
                }
                return;
            }

            const userAnswersArray = Array.from(userAnswerSet).sort();
            const correctAnswersArray = [...questionData.答案].sort();
            const isCompletelyCorrect = JSON.stringify(userAnswersArray) === JSON.stringify(correctAnswersArray) && userAnswersArray.length === correctAnswersArray.length;

            if (isCompletelyCorrect) {
                if (lastCorrectlyAnsweredQId !== answeredQuestionId) { // 首次答对该题
                    consecutiveCorrectStreak++;
                    lastCorrectlyAnsweredQId = answeredQuestionId;
                } // 如果是修改已答对的题，并且仍然正确，不重复增加 streak
            } else {
                // 如果答案不完全正确，或者从正确改为了不正确
                consecutiveCorrectStreak = 0;
                lastCorrectlyAnsweredQId = null; // 不再是上一道答对的题
            }

            console.log("Consecutive correct streak: ", consecutiveCorrectStreak, "Last qid: ", lastCorrectlyAnsweredQId);

            if (consecutiveCorrectStreak >= 3) {
                consecutiveCorrectStreak = 0;
                lastCorrectlyAnsweredQId = null;

                // 修复后的跳转逻辑
                let firstUnansweredIndex = -1;
                for (let i = 0; i < currentPaper.length; i++) {
                    const q = currentPaper[i];
                    // 使用双重验证机制
                    const hasAnswer = selectedAnswers.has(q.题号);
                    const answerValid = hasAnswer && selectedAnswers.get(q.题号).size > 0;
                    
                    if (!answerValid) {
                        firstUnansweredIndex = i;
                        break;
                    }
                }

                // 新增边界检查
                if (firstUnansweredIndex !== -1 && 
                    firstUnansweredIndex !== currentQuestionIndex &&
                    firstUnansweredIndex < currentPaper.length) 
                {
                    // 添加跳转安全校验
                    const validTarget = Math.min(Math.max(firstUnansweredIndex, 0), currentPaper.length-1);
                    showQuestion(validTarget, validTarget > currentQuestionIndex ? 'next' : 'prev');
                }
            }
        }

        // 提交答案
        document.getElementById('submit').addEventListener('click', () => {
            if(timeEstimationInterval) clearInterval(timeEstimationInterval); // 提交后停止计时器
            document.getElementById('time-estimation').textContent = ''; // 清空预计时间显示
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]); // 提交时震动模式
            }
            currentScore = 0;
            totalScore = currentPaper.reduce((sum, q) => sum + q.分值, 0);
            
            // 显示正确和错误的答案
            const results = [];
            currentPaper.forEach(q => {
                const userAnswers = [...(selectedAnswers.get(q.题号) || [])];
                const correctAnswers = q.答案;
                
                // 检查是否正确
                const isCorrect = JSON.stringify(userAnswers.sort()) === JSON.stringify(correctAnswers.sort());
                if (isCorrect) {
                    currentScore += q.分值;
                }
                
                // 高亮显示正确和错误的选项
                document.querySelectorAll(`[data-qid="${q.题号}"]`).forEach(o => {
                    const optIndex = parseInt(o.dataset.opt);
                    
                    // 移除selected类，添加正确/错误类
                    o.classList.remove('selected');
                    
                    if (correctAnswers.includes(optIndex)) {
                        o.classList.add('correct');
                    } else if (userAnswers.includes(optIndex)) {
                        o.classList.add('incorrect');
                    }
                });
                
                // 记录答题结果
                results.push({
                    question: q,
                    userAnswers: userAnswers,
                    isCorrect: isCorrect
                });
            });
            
            // 更新分数显示并禁用选项
            document.getElementById('score').textContent = `得分: ${currentScore}/${totalScore}`;
            document.querySelectorAll('.option').forEach(o => {
                o.style.pointerEvents = 'none';
            });
            
            // 提交按钮变为不可用
            document.getElementById('submit').disabled = true;
            document.getElementById('prev-question').disabled = true;
            document.getElementById('next-question').disabled = true;
            
            // 显示所有题目
            document.querySelectorAll('.question').forEach(q => {
                q.style.display = 'block';
            });
            
            // 显示弹出层
            showResultModal(results);
            
            // 清除保存的答题状态
            clearQuizState();
            
            // 更新试卷状态
            const paperName = document.getElementById('quiz-title').textContent;
            document.querySelector(`.cell[data-paper="${paperName}"] .status`).textContent = "已完成";
        });

        // 显示结果弹出层
        function showResultModal(results) {
            const modal = document.getElementById('resultModal');
            const resultScore = document.getElementById('resultScore');
            const resultDetails = document.getElementById('resultDetails');
            
            // 设置得分
            resultScore.textContent = `得分: ${currentScore}/${totalScore}`;
            
            // 设置结果详情
            resultDetails.innerHTML = '';
            results.forEach(result => {
                const question = result.question;
                const userAnswers = result.userAnswers;
                const isCorrect = result.isCorrect;
                
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                
                // 问题标题
                const questionTitle = document.createElement('div');
                questionTitle.textContent = `${question.题号}. ${question.题目}`;
                questionTitle.style.fontWeight = 'bold';
                resultItem.appendChild(questionTitle);
                
                // 正确答案
                const correctAnswer = document.createElement('div');
                correctAnswer.className = 'correct-answer';
                correctAnswer.innerHTML = `正确答案: ${question.答案.map(a => String.fromCharCode(65 + a)).join(', ')}`;
                resultItem.appendChild(correctAnswer);
                
                // 用户答案
                const userAnswer = document.createElement('div');
                if (userAnswers.length === 0) {
                    userAnswer.innerHTML = `你的答案: <span class="wrong-answer">未作答</span>`;
                } else {
                    const answerText = userAnswers.map(a => String.fromCharCode(65 + a)).join(', ');
                    userAnswer.innerHTML = `你的答案: ${isCorrect ? '<span class="correct-answer">' : '<span class="wrong-answer">'}${answerText}</span>`;
                }
                resultItem.appendChild(userAnswer);
                
                // 分隔线
                const divider = document.createElement('hr');
                divider.style.margin = '10px 0';
                resultItem.appendChild(divider);
                
                resultDetails.appendChild(resultItem);
            });
            
            // 添加导出结果按钮
            const exportButton = document.createElement('button');
            exportButton.textContent = '导出结果';
            exportButton.onclick = exportResults;
            resultDetails.appendChild(exportButton);
            
            // 显示弹出层
            modal.style.display = 'block';
        }

        // 导出结果为文件
        function exportResults() {
            const paperName = document.getElementById('quiz-title').textContent;
            const score = document.getElementById('score').textContent;
            
            let content = `${paperName} - ${score}\n\n`;
            
            currentPaper.forEach(q => {
                const userAnswers = selectedAnswers.get(q.题号) ? [...(selectedAnswers.get(q.题号) || [])] : [];
                const correctAnswers = q.答案;
                const isCorrect = JSON.stringify(userAnswers.sort()) === JSON.stringify(correctAnswers.sort());
                
                content += `${q.题号}. ${q.题目}\n`;
                content += `正确答案: ${correctAnswers.map(a => String.fromCharCode(65 + a)).join(', ')}\n`;
                
                if (userAnswers.length === 0) {
                    content += `你的答案: 未作答\n`;
                } else {
                    content += `你的答案: ${userAnswers.map(a => String.fromCharCode(65 + a)).join(', ')}\n`;
                }
                
                content += `结果: ${isCorrect ? '正确' : '错误'}\n\n`;
            });
            
            // 创建下载链接
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${paperName}_答题结果_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // 关闭弹出层
        document.getElementById('closeModal').addEventListener('click', () => {
            document.getElementById('resultModal').style.display = 'none';
        });

        // 点击关闭按钮
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('resultModal').style.display = 'none';
        });

        // 点击模态框外部关闭
        document.getElementById('resultModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('resultModal')) {
                document.getElementById('resultModal').style.display = 'none';
            }
        });

        // 重置答题
        document.getElementById('reset').addEventListener('click', () => {
            if(timeEstimationInterval) clearInterval(timeEstimationInterval);
            quizStartTime = new Date(); // 重置时也重新开始计时
            timeEstimationInterval = setInterval(updateEstimatedCompletionTime, 1000); // 每1秒更新一次
            document.getElementById('time-estimation').textContent = '';
            if (navigator.vibrate) {
                navigator.vibrate(70);
            }
            currentScore = 0;
            document.getElementById('score').textContent = '得分: 0';
            selectedAnswers.clear();
            renderQuestions();
            document.getElementById('submit').disabled = false;
            document.getElementById('resultModal').style.display = 'none';
            document.getElementById('prev-question').disabled = false;
            document.getElementById('next-question').disabled = false;
            currentQuestionIndex = 0;
            updateProgressBar();
            renderQuestionNav();
            
            // 清除保存的答题状态
            clearQuizState();
        });

        // 上一题/下一题
        document.getElementById('prev-question').addEventListener('click', () => {
            // 震动已在 showQuestion 中处理（如果带 direction 参数）
            showQuestion(currentQuestionIndex - 1, 'prev');
        });

        document.getElementById('next-question').addEventListener('click', () => {
            const currentQ = currentPaper[currentQuestionIndex];
            const isCurrentAnswered = selectedAnswers.has(currentQ.题号) && selectedAnswers.get(currentQ.题号).size > 0;
            
            if (currentQuestionIndex < currentPaper.length - 1) { // 检查是否已经是最后一题了
                if (!isCurrentAnswered) {
                    alert("请先回答当前题目，再进入下一题。");
                    return;
                }
                showQuestion(currentQuestionIndex + 1, 'next');
            } else {
                 // 如果已经是最后一题，按钮本身应该已经是禁用的，但作为双重保险
                console.log("Already on the last question.");
            }
        });

        // 初始化
        document.addEventListener('DOMContentLoaded', () => {
            // 表格点击事件
            document.querySelectorAll('.cell[data-paper]').forEach(cell => {
                cell.addEventListener('click', function() {
                    document.querySelectorAll('.cell').forEach(c => c.dataset.selected = false);
                    this.dataset.selected = true;
                    startQuiz.call(this);
                });
            });
            
            // 检查是否有保存的状态，如果有则显示恢复上次答题的按钮
            const savedState = loadQuizState();
            if (savedState) {
                const timestamp = new Date(savedState.timestamp);
                const formattedTime = timestamp.toLocaleString();
                
                const resumeButton = document.createElement('button');
                resumeButton.textContent = `恢复 ${savedState.paperName} 答题 (${formattedTime})`;
                resumeButton.onclick = () => {
                    // 找到对应的试卷单元格并模拟点击
                    const cell = document.querySelector(`.cell[data-paper="${savedState.paperName}"]`);
                    if (cell) {
                        cell.click();
                    }
                };
                
                const container = document.querySelector('.container');
                container.insertBefore(resumeButton, container.firstChild);
            }

            // 题号搜索框事件监听
            const searchInput = document.getElementById('question-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    const navItems = document.querySelectorAll('#question-nav .question-nav-item');
                    navItems.forEach(item => {
                        const questionNumber = item.querySelector('span:not(.tooltip)') ? item.querySelector('span:not(.tooltip)').textContent.toLowerCase() : ''; // 主要内容，可能是题号或图标
                        const tooltipText = item.querySelector('.tooltip') ? item.querySelector('.tooltip').textContent.toLowerCase() : '';
                        // 检查主要内容或 tooltip 是否包含搜索词
                        if (questionNumber.includes(searchTerm) || tooltipText.includes(searchTerm)) {
                            item.style.display = 'flex'; // 或者 block，根据 nav-item 的 display 类型
                        } else {
                            item.style.display = 'none';
                        }
                    });
                });
            }
        });

        // 主题切换
        const themeToggle = document.getElementById('theme-toggle');
        const root = document.documentElement;
        
        // 检查本地存储中的主题偏好
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            root.classList.add('dark-mode');
        }
        
        // 主题切换事件监听
        themeToggle.addEventListener('click', () => {
            root.classList.toggle('dark-mode');
            // 保存主题偏好到本地存储
            const isDarkMode = root.classList.contains('dark-mode');
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        });
        
        // 检查系统偏好
        if (!savedTheme) {
            const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDarkMode) {
                root.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            }
        }

        function updateEstimatedCompletionTime() {
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
            const day = now.getDate().toString().padStart(2, '0');
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const seconds = now.getSeconds().toString().padStart(2, '0');
            const currentTimeString = `当前时间: ${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            
            const timeEstimationDiv = document.getElementById('time-estimation');
            if (timeEstimationDiv) {
                timeEstimationDiv.textContent = currentTimeString;
            }

            // 原有的逻辑，在所有题目答完后清除 interval，这里可以保留，或者根据需求调整
            // 如果只是显示当前时间，这个 interval 也可以一直运行，或者在提交答案后清除。
            const answeredCount = Array.from(selectedAnswers.keys()).filter(key => selectedAnswers.get(key) && selectedAnswers.get(key).size > 0).length;
            const totalCount = currentPaper.length;
            if (totalCount > 0 && answeredCount >= totalCount && timeEstimationInterval) {
                 // console.log("All questions answered, or paper not started. Clearing time interval if active.");
                 // clearInterval(timeEstimationInterval);
                 // timeEstimationInterval = null; //  确保 interval ID 被清除
            } 
        }

        function handleLongPress(questionDiv, qid) {
            if (questionsToReview.has(qid)) {
                questionsToReview.delete(qid);
                questionDiv.classList.remove('marked-for-review');
                const indicator = questionDiv.querySelector('.review-indicator');
                if (indicator) indicator.remove();
            } else {
                questionsToReview.add(qid);
                questionDiv.classList.add('marked-for-review');
                addReviewIndicator(questionDiv, qid); // 添加可点击的取消标记
                if (navigator.vibrate) navigator.vibrate(60);
            }
            renderQuestionNav(); // 更新导航栏标记
            saveQuizState(); // 保存状态（待复查列表也应保存）
        }

        function addReviewIndicator(questionDiv, qid) {
            let indicator = questionDiv.querySelector('.review-indicator');
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'review-indicator';
                indicator.innerHTML = '⭐'; // 或 FontAwesome 图标 <i class="fa-solid fa-star"></i>
                indicator.title = '点击取消复查标记';
                questionDiv.insertBefore(indicator, questionDiv.firstChild);
                indicator.onclick = (e) => {
                    e.stopPropagation(); // 防止触发题目切换等其他事件
                    handleLongPress(questionDiv, qid); // 点击图标也执行切换标记逻辑
                };
            }
        }

        // ================= 背景主题切换 =================
        const bodyElement = document.body;
        const themeButtons = {
            default: document.getElementById('theme-btn-default'),
            vibrant: document.getElementById('theme-btn-vibrant'),
            night: document.getElementById('theme-btn-night'),
            green: document.getElementById('theme-btn-green'),
            ocean: document.getElementById('theme-btn-ocean'),
            sunset: document.getElementById('theme-btn-sunset'),
            forest: document.getElementById('theme-btn-forest'),
            starry: document.getElementById('theme-btn-starry'),
            macaron: document.getElementById('theme-btn-macaron'),
            mono: document.getElementById('theme-btn-mono')
        };
        const themeClasses = {
            vibrant: 'theme-vibrant-gradient',
            night: 'theme-calm-night',
            green: 'theme-eye-care-green',
            ocean: 'theme-ocean-breath',
            sunset: 'theme-sunset-glow',
            forest: 'theme-forest-realm',
            starry: 'theme-starry-night',
            macaron: 'theme-sweet-macaron',
            mono: 'theme-simple-mono'
        };
        const BODY_THEME_STORAGE_KEY = 'selectedBodyTheme';
        const CUSTOM_BG_STORAGE_KEY = 'customBodyBackground'; // 将此行从自定义背景区域提前到这里
        // 移除这行: // const CUSTOM_BG_STORAGE_KEY = 'customBodyBackground'; // 确保此变量已在自定义背景部分定义

        function applyBodyTheme(themeName) {
            // 移除所有可能存在的主题类
            Object.values(themeClasses).forEach(className => {
                bodyElement.classList.remove(className);
            });

            // 清除自定义背景样式和存储，因为预设主题优先
            bodyElement.style.background = '';
            bodyElement.style.backgroundAttachment = '';
            localStorage.removeItem(CUSTOM_BG_STORAGE_KEY); // CUSTOM_BG_STORAGE_KEY 在自定义背景部分定义

            if (themeName && themeClasses[themeName]) {
                bodyElement.classList.add(themeClasses[themeName]);
                localStorage.setItem(BODY_THEME_STORAGE_KEY, themeName);
            } else {
                // 默认主题 (themeName is null)，清除预设主题存储，依赖基础的深浅模式背景
                localStorage.removeItem(BODY_THEME_STORAGE_KEY);
            }
        }

        // 为按钮添加事件监听
        if (themeButtons.default) {
            themeButtons.default.addEventListener('click', () => applyBodyTheme(null));
        }
        if (themeButtons.vibrant) {
            themeButtons.vibrant.addEventListener('click', () => applyBodyTheme('vibrant'));
        }
        if (themeButtons.night) {
            themeButtons.night.addEventListener('click', () => applyBodyTheme('night'));
        }
        if (themeButtons.green) {
            themeButtons.green.addEventListener('click', () => applyBodyTheme('green'));
        }
        // 新增事件监听器
        if (themeButtons.ocean) {
            themeButtons.ocean.addEventListener('click', () => applyBodyTheme('ocean'));
        }
        if (themeButtons.sunset) {
            themeButtons.sunset.addEventListener('click', () => applyBodyTheme('sunset'));
        }
        if (themeButtons.forest) {
            themeButtons.forest.addEventListener('click', () => applyBodyTheme('forest'));
        }
        if (themeButtons.starry) {
            themeButtons.starry.addEventListener('click', () => applyBodyTheme('starry'));
        }
        if (themeButtons.macaron) {
            themeButtons.macaron.addEventListener('click', () => applyBodyTheme('macaron'));
        }
        if (themeButtons.mono) {
            themeButtons.mono.addEventListener('click', () => applyBodyTheme('mono'));
        }

        // 页面加载时应用已保存的背景主题
        const savedBodyTheme = localStorage.getItem(BODY_THEME_STORAGE_KEY);
        if (savedBodyTheme) {
            applyBodyTheme(savedBodyTheme);
        }

        // ================= 自定义背景调色板 =================
        const bgColor1Input = document.getElementById('bgColor1');
        const bgColor2Input = document.getElementById('bgColor2');
        const applyCustomBgButton = document.getElementById('applyCustomBg');
        const clearCustomBgButton = document.getElementById('clearCustomBg');
        // const CUSTOM_BG_STORAGE_KEY = 'customBodyBackground'; // 此行已被移到前面

        function applyCustomBackground() {
            const color1 = bgColor1Input.value;
            const color2 = bgColor2Input.value;
            const gradientType = document.querySelector('input[name="gradientType"]:checked').value;
            let backgroundStyle = '';

            if (gradientType === 'solid' || !color2) {
                backgroundStyle = color1;
            } else {
                switch (gradientType) {
                    case 'linear-to-right':
                        backgroundStyle = `linear-gradient(to right, ${color1}, ${color2})`;
                        break;
                    case 'linear-to-bottom':
                        backgroundStyle = `linear-gradient(to bottom, ${color1}, ${color2})`;
                        break;
                    case 'linear-to-br':
                        backgroundStyle = `linear-gradient(to bottom right, ${color1}, ${color2})`;
                        break;
                    case 'linear-to-tr':
                        backgroundStyle = `linear-gradient(to top right, ${color1}, ${color2})`;
                        break;
                    case 'radial':
                        backgroundStyle = `radial-gradient(circle, ${color1}, ${color2})`;
                        break;
                    default:
                        backgroundStyle = color1; // 默认为纯色
                }
            }
            
            bodyElement.style.background = backgroundStyle;
            bodyElement.style.backgroundAttachment = 'fixed'; // 保持背景固定
            // 清除预设主题类，因为自定义样式优先级更高
            Object.values(themeClasses).forEach(className => {
                bodyElement.classList.remove(className);
            });
            localStorage.removeItem(BODY_THEME_STORAGE_KEY); // 清除预设主题存储

            // 保存自定义背景设置
            localStorage.setItem(CUSTOM_BG_STORAGE_KEY, JSON.stringify({ color1, color2, gradientType }));
        }

        function clearCustomBackground() {
            bodyElement.style.background = '';
            bodyElement.style.backgroundAttachment = '';
            localStorage.removeItem(CUSTOM_BG_STORAGE_KEY);
            // 恢复到最近选择的预设主题，或者如果没有，则恢复到深浅模式的默认背景
            const lastSelectedTheme = localStorage.getItem(BODY_THEME_STORAGE_KEY);
            if (lastSelectedTheme) {
                applyBodyTheme(lastSelectedTheme); // 尝试应用上一个预设主题
            } else {
                applyBodyTheme(null); // 否则，恢复到完全默认（即仅深/浅模式的基础背景）
            }
        }

        if (applyCustomBgButton) {
            applyCustomBgButton.addEventListener('click', applyCustomBackground);
        }
        if (clearCustomBgButton) {
            clearCustomBgButton.addEventListener('click', clearCustomBackground);
        }

        // 页面加载时应用已保存的自定义背景
        const savedCustomBg = localStorage.getItem(CUSTOM_BG_STORAGE_KEY);
        if (savedCustomBg) {
            try {
                const { color1, color2, gradientType } = JSON.parse(savedCustomBg);
                bgColor1Input.value = color1;
                bgColor2Input.value = color2;
                const radioToCheck = document.querySelector(`input[name="gradientType"][value="${gradientType}"]`);
                if (radioToCheck) radioToCheck.checked = true;
                
                applyCustomBackground(); // 应用保存的自定义背景
            } catch (e) {
                console.error("Error loading custom background: ", e);
                localStorage.removeItem(CUSTOM_BG_STORAGE_KEY); // 如果解析失败则清除
            }
        } else if (savedBodyTheme) { // 如果没有自定义背景，但有预设主题，则应用预设
            applyBodyTheme(savedBodyTheme);
        }

        // ================= 设置面板显隐控制 =================
        const settingsToggleButton = document.getElementById('settings-toggle-button');
        const settingsPanel = document.getElementById('settings-panel');

        if (settingsToggleButton && settingsPanel) {
            settingsToggleButton.addEventListener('click', (event) => {
                event.stopPropagation(); // 防止点击事件冒泡到可能存在的全局关闭监听器
                settingsPanel.classList.toggle('active');
            });

            // 可选：点击面板外部关闭面板
            document.addEventListener('click', (event) => {
                if (settingsPanel.classList.contains('active') && 
                    !settingsPanel.contains(event.target) && 
                    event.target !== settingsToggleButton) {
                    settingsPanel.classList.remove('active');
                }
            });
        }

    // iOS视口高度动态计算
    function handleIOSViewport() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    window.addEventListener('resize', handleIOSViewport);
    handleIOSViewport();

    // iOS手势交互优化
    // 3D Touch压力检测
    let forceValue = 0;
    const handleForceTouch = (e) => {
        if (e.webkitForce) {
            forceValue = e.webkitForce;
            if (forceValue > 1) {
                document.documentElement.classList.add('peek-mode');
            } else { //  确保在压力减小时移除类
                document.documentElement.classList.remove('peek-mode');
            }
        }
    };
    //  监听 touchforcechange 事件 (如果可用)
    if ('ontouchforcechange' in document.documentElement) {
        document.addEventListener('touchforcechange', handleForceTouch, { passive: true });
    } else { //  回退到 mousemove/touchmove (虽然不完美，但作为一种尝试)
        document.addEventListener('touchmove', handleForceTouch, { passive: true });
    }


    // 边缘返回手势拦截
    document.body.addEventListener('touchstart', (e) => {
        if (e.touches[0].pageX < 30 && e.touches.length === 1) { // 仅当单指触摸屏幕左边缘时
            //  可以添加更复杂的逻辑，例如检查当前是否在答题界面等
            // e.preventDefault(); //  取消注释以启用拦截，但要注意可能影响正常滑动
            console.log("Edge swipe detected, default prevention might be needed here.");
        }
    }, { passive: true }); //  如果内部没有调用 e.preventDefault()，则设为 true 提高性能

    // 弹性滚动限制 (只限制.container的直接touchmove，防止内容滚动时意外触发)
    const mainContainerForScrollLock = document.querySelector('.container');
    if (mainContainerForScrollLock) {
        mainContainerForScrollLock.addEventListener('touchmove', (e) => {
            //  这个逻辑可能过于激进，如果容器本身需要滚动则会阻止
            //  一个更完善的方案是检查 e.target 是否是可滚动元素或者其父元素
            if (window.scrollY <= 0 && e.currentTarget.scrollTop <= 0 ) { 
                // e.preventDefault(); //  取消注释以启用拦截，但要注意可能影响正常滚动
                console.log("Boucne scroll lock activated at top");
            }
        }, { passive: true }); //  如果内部没有调用 e.preventDefault()，则设为 true
    }

    // Safari性能优化
    // iOS WebGL加速
    const enableWebGL = () => {
        const canvas = document.createElement('canvas');
        try {
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl && typeof gl.getParameter === 'function') { // 确保gl上下文有效
                document.body.classList.add('webgl-enabled');
                console.log('WebGL enabled');
            }
        } catch (e) {
            console.warn('WebGL could not be initialized.', e);
        }
    };
    enableWebGL(); //  页面加载时尝试启用

    // Safari字体加载优化
    if (document.fonts && typeof document.fonts.ready === 'object') { // 检查 document.fonts.ready 是否存在且为 Promise
        document.fonts.ready.then(() => {
            document.body.style.visibility = 'visible';
            performance.mark('fontsLoaded');
            console.log('Fonts loaded and visible.');
        }).catch(error => {
            console.warn('Font loading optimization error:', error);
            document.body.style.visibility = 'visible'; //  即使出错也确保body可见
        });
    } else {
        document.body.style.visibility = 'visible'; //  如果API不支持，直接设为可见
    }

    // 内存优化
    const optimizeMemory = () => {
        if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) { // 确保是iOS设备
            if (window.performance && window.performance.memory && window.performance.memory.jsHeapSizeLimit > 1e9) {
                requestAnimationFrame(() => { 
                    document.body.classList.add('memory-optimized');
                    console.log('Memory optimization applied for iOS.');
                });
            }
        }
    };
    optimizeMemory(); //  页面加载时尝试优化

    // 触摸事件增强 (通用)
    //  为避免与现有的滑动切题逻辑 (handleTouchStart, handleTouchMove, handleTouchEnd) 冲突，
    //  这里的 goPrev 和 goNext 需要是实际存在的函数，或者需要整合。
    //  当前版本的代码中，showQuestion(currentQuestionIndex - 1, 'prev') 和 showQuestion(currentQuestionIndex + 1, 'next') 
    //  是实际的翻页函数。为了演示，这里暂时定义空的 goPrev/goNext。
    //  在实际应用中，应替换为正确的函数调用或整合逻辑。
    function goPrev() { 
        console.log('Attempting to go to previous question via touchHandler');
        if (typeof showQuestion === 'function') showQuestion(currentQuestionIndex - 1, 'prev');
    }
    function goNext() { 
        console.log('Attempting to go to next question via touchHandler');
        if (typeof showQuestion === 'function') showQuestion(currentQuestionIndex + 1, 'next');
    }

    const touchHandler = {
        startX: 0,
        startY: 0,
        threshold: 15,
        isSwipePrevented: false, //  新增标志位，防止垂直滚动时误判为滑动

        handleStart: (e) => {
            //  只在 questions-container 区域内触发增强的触摸事件
            if (!e.target.closest('#questions-container')) return;
            touchHandler.startX = e.touches[0].clientX;
            touchHandler.startY = e.touches[0].clientY;
            touchHandler.isSwipePrevented = false; //  重置标志位
        },

        handleMove: (e) => {
            if (!e.target.closest('#questions-container') || touchHandler.isSwipePrevented) return;
            const deltaX = e.touches[0].clientX - touchHandler.startX;
            const deltaY = e.touches[0].clientY - touchHandler.startY;
            
            //  如果垂直滑动距离超过阈值，则判定为滚动，并阻止后续的水平滑动判断
            if (Math.abs(deltaY) > touchHandler.threshold) {
                touchHandler.isSwipePrevented = true;
                return;
            }
            
            //  如果水平滑动距离也超过阈值 (且垂直滑动未优先)，则阻止默认滚动行为，为切题做准备
            if (Math.abs(deltaX) > touchHandler.threshold) {
                 e.preventDefault(); //  只在确定是水平滑动时才阻止默认行为
            }
        },

        handleEnd: (e) => {
            if (!e.target.closest('#questions-container') || touchHandler.isSwipePrevented) return;
            
            const isHuawei = /HUAWEI|HONOR/i.test(navigator.userAgent); //  移到这里，只在需要时检测
            const compensation = isHuawei ? 1.3 : 1;
            
            const deltaX = (e.changedTouches[0].clientX - touchHandler.startX) * compensation;
            if (Math.abs(deltaX) > 50) { //  SWIPE_THRESHOLD_ENHANCED (可以设为独立的常量)
                deltaX < 0 ? goNext() : goPrev(); //  注意：这里应该是 deltaX > 0 ? goPrev() : goNext()
            }
        }
    };

    // 厂商级JavaScript特性检测
    const browser = {
        isHuawei: /HUAWEI|HONOR/i.test(navigator.userAgent),
        isXiaomi: /MiuiBrowser/i.test(navigator.userAgent) || /XiaoMi/i.test(navigator.userAgent),
        isOppo: /HeytapBrowser/i.test(navigator.userAgent) || /OPPO/i.test(navigator.userAgent),
        isVivo: /VivoBrowser/i.test(navigator.userAgent) || /VIVO/i.test(navigator.userAgent)
    };

    if(browser.isXiaomi) {
        // 小米浏览器GPU加速
        const containerElement = document.querySelector('.container');
        if (containerElement) {
            containerElement.style.transform = 'translateZ(0)';
            console.log("Xiaomi GPU acceleration hint applied.");
        }
    }

    // 通用性能优化
    // 滚动性能优化（针对所有厂商）
    const optimizeScroll = () => {
        const scrollables = document.querySelectorAll('.paper-table, .questions-wrapper, .modal-body, .settings-panel'); //  添加更多可能滚动的区域
        scrollables.forEach(el => {
            el.style.overflowScrolling = 'touch';
            el.style.webkitOverflowScrolling = 'touch';
        });
        console.log("Scroll optimization applied to relevant elements.");
    };
    optimizeScroll(); //  页面加载时执行

    // 图片延迟加载（适配厂商懒加载差异）
    //  此项目当前没有动态加载的图片，但保留框架以备将来使用
    const lazyLoadImages = () => {
        const imagesToLoad = document.querySelectorAll('img[data-src]');
        if (imagesToLoad.length === 0) return;

        const observer = new IntersectionObserver((entries, self) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src'); //  移除属性避免重复加载
                    self.unobserve(img);
                    console.log(`Image ${img.src} lazy loaded.`);
                }
            });
        }, {
            rootMargin: (browser.isOppo ? '300px' : '200px') + ' 0px ' + (browser.isOppo ? '300px' : '200px') + ' 0px' //  更完整的rootMargin
        });

        imagesToLoad.forEach(img => {
            observer.observe(img);
        });
    };
    lazyLoadImages(); //  页面加载时执行
    // ================= 音乐播放器功能 =================
const musicToggle = document.getElementById('music-toggle');
const musicPanel = document.getElementById('music-panel');
let currentTrackIndex = 0;
let tracks = [];

// 初始化示例音乐
function initMusicPlayer() {
    addTrackToPlaylist('./Music/麻醉师.mp3', '麻醉师 - 胡睿');
    addTrackToPlaylist('./Music/跳楼机.mp3', '跳楼机 - LBL');
    addTrackToPlaylist('./Music/愿与愁.mp3', '愿与愁 - 林俊杰');
    addTrackToPlaylist('./Music/特别的人(Special Person).mp3', '特别的人 - 方大同');
    addTrackToPlaylist('./Music/不说 (原来是不说).mp3', '不说 - 周公');
    addTrackToPlaylist('./Music/BabyDontCry.mp3', '人鱼的眼泪 - EXO');
    addTrackToPlaylist('./Music/Always Online.mp3', 'Always Online - 林俊杰');
    addTrackToPlaylist('./Music/我还想她(I Still Miss Her).mp3', '我还想她 - 林俊杰');
}

function addTrackToPlaylist(audioUrl, title) {
    const trackData = { src: audioUrl, title };
    tracks.push(trackData);

    const listItem = document.createElement('li');
    listItem.textContent = title;
    listItem.addEventListener('click', () => playTrack(tracks.indexOf(trackData)));
    document.getElementById('playlist').appendChild(listItem);
}

function playTrack(index) {
    if (index >= 0 && index < tracks.length) {
        currentTrackIndex = index;
        const track = tracks[currentTrackIndex];
        const audioPlayer = document.getElementById('audioPlayer');

        // 更新播放列表样式
        document.querySelectorAll('#playlist li').forEach(li => 
            li.classList.remove('current')
        );
        document.querySelectorAll('#playlist li')[index].classList.add('current');

        audioPlayer.src = track.src;
        audioPlayer.play();
    }
}

// 确保DOM加载完成后绑定事件
document.addEventListener('DOMContentLoaded', () => {
    // 获取音乐相关元素
    const musicToggle = document.getElementById('music-toggle');
    const musicPanel = document.getElementById('music-panel');
    const closeMusicPanel = document.getElementById('close-music-panel');
    const prevTrack = document.getElementById('prevTrack');
    const nextTrack = document.getElementById('nextTrack');
    // 事件监听
    musicToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        musicPanel.classList.toggle('active');
    });

    document.getElementById('close-music-panel').addEventListener('click', () => {
        musicPanel.classList.remove('active');
    });

    document.getElementById('prevTrack').addEventListener('click', () => {
        currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
        playTrack(currentTrackIndex);
    });

    document.getElementById('nextTrack').addEventListener('click', () => {
        currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
        playTrack(currentTrackIndex);
    });

    // 点击外部关闭面板
    document.addEventListener('click', (e) => {
        if (!musicPanel.contains(e.target) && 
            e.target !== musicToggle &&
            musicPanel.classList.contains('active')) {
            musicPanel.classList.remove('active');
        }
    });
    // 正确放置关闭按钮的事件监听
    document.getElementById('close-music-panel').addEventListener('click', () => {
        musicPanel.classList.remove('active');
    });

    // 初始化音乐播放器
    initMusicPlayer();
});