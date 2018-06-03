/**
 *  抓取智联招聘nodejs相关岗位的信息
 *  获取方式： http://sou.zhaopin.com/jobs/searchresult.ashx?jl=%E6%B7%B1%E5%9C%B3&kw=node&p=1
 *  容器 #newlist_list_content_table .newlist
 *  position .zwmc a
 *  company: .gsmc a[0]
 *  salary: .zwyx 
 *  area: .gzdd
 */

const http = require('http');
const cheerio = require('cheerio')
const fs = require('fs')
const createCSVFile = require('csv-file-creator');
// getting page
let page = 1;
let totalpage = 1;
let positionData = [];

// 获取第一页数据
let options = {
    hostname: 'sou.zhaopin.com',
    port: 80,
    path: `/jobs/searchresult.ashx?jl=%E6%B7%B1%E5%9C%B3&kw=node&p=${page}`,
    method: 'get',
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
};


function handleHtml(html) {
    const $ = cheerio.load(html);
    
    const wrap = $('#newlist_list_content_table');
    const list = wrap.find('.newlist');

    list.each(function(i, elem) {
        let position = {
            name: $(this).find('.zwmc').find('a').text(),
            company: $(this).find('.gsmc').find('a').text(),
            salary: $(this).find('.zwyx').text(),
            area: $(this).find('.gzdd').text()
        };

        positionData.push(position);
    });    

    // 如果当前是第一页的数据，则获取总页数
    if(page == 1) {
        // 倒数第四个li为最后的页码
        const li = $('.pagesDown').find('li');
        const li_len = li.length;
        const last_page = li.eq(li_len - 4);

        totalpage = parseInt(last_page.text());
    }

    if(page < totalpage) {
        page += 1;
        getData();
    }else {
        console.log('.... End ....');

        // 把数据存放到excel表格中，做处理
        saveToCvs();
        

        // 把数据存如json文件
        saveToJson();
    }
    
    
}

function saveToCvs (){
    let cvsdata = [];
    positionData.map((item) => {
        cvsdata.push([
            item.name,
            item.company,
            item.salary,
            item.area
        ]);
    })
    try {
        createCSVFile('./result/data.csv', cvsdata);
        console.log('The cvs file has been saved!')
    } catch (error) {
        console.log('Save cvs file failed! ', error)
    }
    
} 

function saveToJson() {
    fs.writeFile('./result/data.json', JSON.stringify(positionData), (err) => {
        if (err) throw err;
        console.log('The json file has been saved!');
    });
}

function getData() {
    console.log(`=== download page ${page} ===`)

    options.path = `/jobs/searchresult.ashx?jl=%E6%B7%B1%E5%9C%B3&kw=node&p=${page}`;

    http.get(options, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];
    
        let error;
        if (statusCode !== 200) {
        error = new Error('Request Failed.\n' +
                            `Status Code: ${statusCode}`);
        }
    
        if (error) {
        console.error(error.message);
        // consume response data to free up memory
        res.resume();
        return;
        }
    
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
        //   数据交给 函数 处理
        handleHtml(rawData);
        });
    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
}

// 开始获取数据
console.log('.... Start ....')
getData();
